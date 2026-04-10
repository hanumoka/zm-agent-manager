import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { scanConfigSummary } from '../config-scanner';

const ROOT = join(tmpdir(), 'zm-config-scanner-test');

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('scanConfigSummary', () => {
  it('빈 프로젝트 → 모든 필드 빈 배열', async () => {
    const result = await scanConfigSummary({ projectRoot: ROOT });
    expect(result.hooks).toEqual([]);
    expect(result.rules).toEqual([]);
    expect(result.mcpServers).toEqual([]);
    expect(result.permissionsAllow).toEqual([]);
    expect(result.permissionsDeny).toEqual([]);
  });

  it('hooks 파싱 — 이벤트별 그룹', async () => {
    const claudeDir = join(ROOT, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(
      join(claudeDir, 'settings.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: 'Edit|Write',
              hooks: [{ type: 'command', command: 'echo check' }],
            },
          ],
          Stop: [
            {
              matcher: '*',
              hooks: [{ type: 'prompt', prompt: 'summarize' }],
            },
          ],
        },
      })
    );

    const result = await scanConfigSummary({ projectRoot: ROOT });
    expect(result.hooks).toHaveLength(2);
    expect(result.hooks[0].event).toBe('PreToolUse');
    expect(result.hooks[0].matcher).toBe('Edit|Write');
    expect(result.hooks[0].type).toBe('command');
    expect(result.hooks[0].command).toBe('echo check');
    expect(result.hooks[1].event).toBe('Stop');
    expect(result.hooks[1].command).toBe('summarize');
  });

  it('rules 파싱 — .md 파일 목록', async () => {
    const rulesDir = join(ROOT, '.claude', 'rules');
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, 'my-rule.md'), '# My Rule\nContent here');
    writeFileSync(join(rulesDir, 'another.md'), '# Another');

    const result = await scanConfigSummary({ projectRoot: ROOT });
    expect(result.rules).toHaveLength(2);
    expect(result.rules.map((r) => r.name).sort()).toEqual(['another', 'my-rule']);
    expect(result.rules[0].sizeBytes).toBeGreaterThan(0);
  });

  it('MCP 서버 파싱', async () => {
    writeFileSync(
      join(ROOT, '.mcp.json'),
      JSON.stringify({
        mcpServers: {
          filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] },
          custom: { command: 'node', args: ['server.js'] },
        },
      })
    );

    const result = await scanConfigSummary({ projectRoot: ROOT });
    expect(result.mcpServers).toHaveLength(2);
    expect(result.mcpServers.map((s) => s.name).sort()).toEqual(['custom', 'filesystem']);
    expect(result.mcpServers.find((s) => s.name === 'filesystem')!.command).toBe('npx');
  });

  it('permissions 파싱 — allow/deny', async () => {
    const claudeDir = join(ROOT, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(
      join(claudeDir, 'settings.json'),
      JSON.stringify({
        permissions: {
          allow: ['Read', 'Grep'],
          deny: ['Bash(rm *)'],
        },
      })
    );

    const result = await scanConfigSummary({ projectRoot: ROOT });
    expect(result.permissionsAllow).toEqual(['Read', 'Grep']);
    expect(result.permissionsDeny).toEqual(['Bash(rm *)']);
  });

  it('잘못된 JSON은 빈 결과', async () => {
    const claudeDir = join(ROOT, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(join(claudeDir, 'settings.json'), 'NOT VALID JSON');
    writeFileSync(join(ROOT, '.mcp.json'), '{bad json}');

    const result = await scanConfigSummary({ projectRoot: ROOT });
    expect(result.hooks).toEqual([]);
    expect(result.mcpServers).toEqual([]);
  });
});
