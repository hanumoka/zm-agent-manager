import { readdir, stat, readFile } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from 'os';
import type { AgentInfo, SkillScope } from '@shared/types';
import { parseFrontmatter } from './skill-scanner';

const DEFAULT_GLOBAL_DIR = join(homedir(), '.claude', 'agents');

/** 테스트에서 fixture 경로 주입. */
export interface AgentScannerOptions {
  /** 프로젝트 `.claude/agents/` 경로. 기본값: `process.cwd()/.claude/agents` */
  projectDir?: string;
  /** 글로벌 에이전트 디렉토리. 기본값: `~/.claude/agents` */
  globalDir?: string;
}

/**
 * 단일 에이전트 .md 파일 파싱.
 * 스킬과 달리 에이전트는 `{name}.md` 형식 (디렉토리가 아님).
 */
async function parseAgentFile(filePath: string, scope: SkillScope): Promise<AgentInfo | null> {
  try {
    const [content, fileStat] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)]);
    const frontmatter = parseFrontmatter(content);
    if (!frontmatter) return null;

    const name = frontmatter.name ?? basename(filePath, '.md');
    const description = frontmatter.description ?? '';
    const model = frontmatter.model;

    // tools는 쉼표 또는 공백 구분
    const toolsRaw = frontmatter.tools ?? '';
    const tools = toolsRaw
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    return {
      name,
      description,
      scope,
      filePath,
      sizeBytes: fileStat.size,
      lastModified: fileStat.mtimeMs,
      tools,
      model,
    };
  } catch {
    return null;
  }
}

/** 단일 에이전트 루트 디렉토리 스캔 (하위 {name}.md 파일들) */
async function scanAgentRoot(root: string, scope: SkillScope): Promise<AgentInfo[]> {
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return [];
  }

  const results = await Promise.all(
    entries.filter((f) => f.endsWith('.md')).map((f) => parseAgentFile(join(root, f), scope))
  );

  return results.filter((a): a is AgentInfo => a !== null);
}

/** 프로젝트 + 글로벌 에이전트 전체 스캔 */
export async function scanAgents(options: AgentScannerOptions = {}): Promise<AgentInfo[]> {
  const projectDir = options.projectDir ?? join(process.cwd(), '.claude', 'agents');
  const globalDir = options.globalDir ?? DEFAULT_GLOBAL_DIR;

  const [projectAgents, globalAgents] = await Promise.all([
    scanAgentRoot(projectDir, 'project'),
    scanAgentRoot(globalDir, 'global'),
  ]);

  const sortByName = (a: AgentInfo, b: AgentInfo): number => a.name.localeCompare(b.name);
  return [...projectAgents.sort(sortByName), ...globalAgents.sort(sortByName)];
}
