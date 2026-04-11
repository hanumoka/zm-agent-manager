import { readdir, stat, readFile } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { homedir } from 'os';
import type { SkillInfo, SkillScope } from '@shared/types';

const DEFAULT_GLOBAL_DIR = join(homedir(), '.claude', 'skills');

/** 테스트에서 fixture 경로 주입. */
export interface SkillScannerOptions {
  /** 프로젝트 `.claude/skills/` 경로. 기본값: `process.cwd()/.claude/skills` */
  projectDir?: string;
  /** 글로벌 스킬 디렉토리. 기본값: `~/.claude/skills` */
  globalDir?: string;
}

/**
 * 아주 가벼운 YAML frontmatter 파서.
 * 완전한 YAML 파서 대신 "key: value" 한 줄 단위만 지원.
 *
 * **지원**:
 * - 리스트: `allowed-tools: Read Grep` (공백 구분만)
 * - 불리언: `disable-model-invocation: true` (문자열 "true"로 저장)
 * - 문자열: `name: my-skill` (양끝 인용 제거)
 *
 * **미지원** (PRD 범위 밖):
 * - 쉼표 구분 리스트: `allowed-tools: Read, Grep` → `["Read,", "Grep"]`로 잘못 파싱됨
 * - 중첩 매핑 / 블록 스칼라(`|`, `>`) / 다중 줄 값
 * - 실제 SKILL.md는 모두 공백 구분 사용하므로 현재 범위에서 안전
 */
export function parseFrontmatter(content: string): Record<string, string> | null {
  const trimmed = content.replace(/^\uFEFF/, '');
  if (!trimmed.startsWith('---')) return null;
  const lines = trimmed.split(/\r?\n/);
  const result: Record<string, string> = {};
  let inFront = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') {
      if (!inFront) {
        inFront = true;
        continue;
      }
      // 종료
      return result;
    }
    if (!inFront) continue;
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (match) {
      const [, key, rawValue] = match;
      // 인용 제거
      const value = rawValue.replace(/^["']|["']$/g, '').trim();
      result[key] = value;
    }
  }
  // 종료 마커 없이 끝났음 — 유효하지 않음
  return null;
}

/** SKILL.md 파일 하나를 파싱하여 SkillInfo 생성. 실패 시 null. */
async function parseSkillFile(skillMdPath: string, scope: SkillScope): Promise<SkillInfo | null> {
  try {
    const [content, fileStat] = await Promise.all([
      readFile(skillMdPath, 'utf-8'),
      stat(skillMdPath),
    ]);
    const frontmatter = parseFrontmatter(content);
    if (!frontmatter) return null;

    const name = frontmatter.name ?? basename(dirname(skillMdPath));
    const description = frontmatter.description ?? '';
    const model = frontmatter.model;
    const disableModelInvocation = frontmatter['disable-model-invocation'] === 'true';

    // allowed-tools는 공백 구분 문자열
    const allowedToolsRaw = frontmatter['allowed-tools'] ?? '';
    const allowedTools = allowedToolsRaw
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    return {
      name,
      description,
      scope,
      filePath: skillMdPath,
      sizeBytes: fileStat.size,
      lastModified: fileStat.mtimeMs,
      allowedTools,
      model,
      disableModelInvocation,
    };
  } catch {
    return null;
  }
}

/** 단일 스킬 루트 디렉토리 스캔 (하위 {name}/SKILL.md 형태) */
async function scanSkillRoot(root: string, scope: SkillScope): Promise<SkillInfo[]> {
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return [];
  }

  const results: (SkillInfo | null)[] = await Promise.all(
    entries.map(async (entry) => {
      const skillDir = join(root, entry);
      try {
        const s = await stat(skillDir);
        if (!s.isDirectory()) return null;
      } catch {
        return null;
      }
      return parseSkillFile(join(skillDir, 'SKILL.md'), scope);
    })
  );

  return results.filter((s): s is SkillInfo => s !== null);
}

/** 프로젝트 + 글로벌 스킬 전체 스캔 */
export async function scanSkills(options: SkillScannerOptions = {}): Promise<SkillInfo[]> {
  const projectDir = options.projectDir ?? join(process.cwd(), '.claude', 'skills');
  const globalDir = options.globalDir ?? DEFAULT_GLOBAL_DIR;

  const [projectSkills, globalSkills] = await Promise.all([
    scanSkillRoot(projectDir, 'project'),
    scanSkillRoot(globalDir, 'global'),
  ]);

  // 프로젝트 우선, 그 다음 글로벌, 각 스코프 내에서는 이름 오름차순
  const sortByName = (a: SkillInfo, b: SkillInfo): number => a.name.localeCompare(b.name);
  return [...projectSkills.sort(sortByName), ...globalSkills.sort(sortByName)];
}
