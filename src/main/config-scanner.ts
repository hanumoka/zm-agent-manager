import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import type { ConfigSummary, HookEntry, RuleFile, McpServer } from '@shared/types';

/** 테스트에서 fixture 경로 주입. */
export interface ConfigScannerOptions {
  /** 프로젝트 루트 경로 (.claude/settings.json, .mcp.json 위치) */
  projectRoot?: string;
}

/**
 * 프로젝트의 settings.json / .claude/rules/ / .mcp.json을 읽어
 * 훅/규칙/MCP/퍼미션 요약을 반환한다.
 */
export async function scanConfigSummary(
  options: ConfigScannerOptions = {}
): Promise<ConfigSummary> {
  const projectRoot = options.projectRoot ?? process.cwd();

  const [hooks, rules, mcpServers, permissions] = await Promise.all([
    scanHooks(projectRoot),
    scanRules(projectRoot),
    scanMcpServers(projectRoot),
    scanPermissions(projectRoot),
  ]);

  return {
    hooks,
    rules,
    mcpServers,
    permissionsAllow: permissions.allow,
    permissionsDeny: permissions.deny,
  };
}

// ─── Hooks ───

async function scanHooks(root: string): Promise<HookEntry[]> {
  const settingsPath = join(root, '.claude', 'settings.json');
  try {
    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw) as {
      hooks?: Record<
        string,
        { matcher: string; hooks: { type: string; command?: string; prompt?: string }[] }[]
      >;
    };
    if (!settings.hooks) return [];

    const entries: HookEntry[] = [];
    for (const [event, matchers] of Object.entries(settings.hooks)) {
      for (const matcherGroup of matchers) {
        for (const hook of matcherGroup.hooks ?? []) {
          entries.push({
            event,
            matcher: matcherGroup.matcher ?? '*',
            type: hook.type ?? 'command',
            command: hook.command ?? hook.prompt ?? '',
          });
        }
      }
    }
    return entries;
  } catch {
    return [];
  }
}

// ─── Rules ───

async function scanRules(root: string): Promise<RuleFile[]> {
  const rulesDir = join(root, '.claude', 'rules');
  try {
    const entries = await readdir(rulesDir);
    const results = await Promise.all(
      entries
        .filter((f) => f.endsWith('.md'))
        .map(async (f) => {
          const filePath = join(rulesDir, f);
          try {
            const s = await stat(filePath);
            return {
              name: f.replace('.md', ''),
              filePath,
              sizeBytes: s.size,
              lastModified: s.mtimeMs,
            };
          } catch {
            return null;
          }
        })
    );
    return results
      .filter((r): r is RuleFile => r !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

// ─── MCP Servers ───

async function scanMcpServers(root: string): Promise<McpServer[]> {
  const mcpPath = join(root, '.mcp.json');
  try {
    const raw = await readFile(mcpPath, 'utf-8');
    const config = JSON.parse(raw) as {
      mcpServers?: Record<string, { command: string; args?: string[] }>;
    };
    if (!config.mcpServers) return [];

    return Object.entries(config.mcpServers).map(([name, server]) => ({
      name,
      command: server.command ?? '',
      args: Array.isArray(server.args) ? server.args : [],
    }));
  } catch {
    return [];
  }
}

// ─── Permissions ───

async function scanPermissions(root: string): Promise<{ allow: string[]; deny: string[] }> {
  const settingsPath = join(root, '.claude', 'settings.json');
  try {
    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw) as {
      permissions?: { allow?: string[]; deny?: string[] };
    };
    return {
      allow: Array.isArray(settings.permissions?.allow) ? settings.permissions.allow : [],
      deny: Array.isArray(settings.permissions?.deny) ? settings.permissions.deny : [],
    };
  } catch {
    return { allow: [], deny: [] };
  }
}
