import { createReadStream } from 'fs';
import { readdir, stat } from 'fs/promises';
import { createInterface } from 'readline';
import { join, basename } from 'path';
import { homedir } from 'os';
import { parseHistoryFile } from './history-parser';

export interface HandoffSummary {
  sessionId: string;
  projectName: string;
  /** 마지막 assistant 메시지의 텍스트 요약 (최대 500자) */
  lastSummary: string;
  /** 세션에서 사용된 도구 목록 (유니크) */
  toolsUsed: string[];
  /** 세션 시작 시각 */
  startedAt: number;
  /** 세션 종료 시각 (마지막 레코드 타임스탬프) */
  endedAt: number;
  /** 프롬프트 수 */
  promptCount: number;
}

export interface HandoffScannerOptions {
  projectsDir?: string;
  historyFile?: string;
}

const DEFAULT_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

/**
 * 단일 JSONL에서 핸드오프 요약 추출
 */
async function extractHandoff(
  filePath: string,
  sessionId: string,
  projectName: string
): Promise<HandoffSummary | null> {
  let lastAssistantText = '';
  const toolsSet = new Set<string>();
  let firstTimestamp = 0;
  let lastTimestamp = 0;
  let promptCount = 0;

  const stream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const raw = JSON.parse(line) as Record<string, unknown>;
        const ts = raw.timestamp as string | number | undefined;
        const tsNum = typeof ts === 'string' ? new Date(ts).getTime() : (ts ?? 0);

        if (firstTimestamp === 0 && tsNum > 0) firstTimestamp = tsNum;
        if (tsNum > lastTimestamp) lastTimestamp = tsNum;

        if (raw.type === 'user') promptCount++;

        if (raw.type === 'assistant') {
          const msg = raw.message as { content?: unknown[] } | undefined;
          if (msg?.content && Array.isArray(msg.content)) {
            for (const block of msg.content) {
              const b = block as { type?: string; text?: string; name?: string };
              if (b.type === 'text' && b.text) {
                lastAssistantText = b.text;
              }
              if (b.type === 'tool_use' && b.name) {
                toolsSet.add(b.name);
              }
            }
          }
        }
      } catch {
        // 잘못된 JSON 스킵
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  if (promptCount === 0) return null;

  return {
    sessionId,
    projectName,
    lastSummary: lastAssistantText.slice(0, 500),
    toolsUsed: [...toolsSet].sort(),
    startedAt: firstTimestamp,
    endedAt: lastTimestamp,
    promptCount,
  };
}

/**
 * 프로젝트별 최근 세션의 핸드오프 요약 스캔
 */
export async function scanHandoffs(
  options: HandoffScannerOptions = {}
): Promise<HandoffSummary[]> {
  const projectsDir = options.projectsDir ?? DEFAULT_PROJECTS_DIR;
  const { projectPathMap } = await parseHistoryFile(options.historyFile);
  const results: HandoffSummary[] = [];

  let dirs: string[];
  try {
    dirs = await readdir(projectsDir);
  } catch {
    return [];
  }

  for (const encodedDir of dirs) {
    const projectDir = join(projectsDir, encodedDir);
    try {
      const s = await stat(projectDir);
      if (!s.isDirectory()) continue;
    } catch {
      continue;
    }

    const projectPath = projectPathMap.get(encodedDir) ?? encodedDir;
    const projectName = projectPathMap.has(encodedDir)
      ? basename(projectPath)
      : (encodedDir.split('-').pop() ?? encodedDir);

    let files: string[];
    try {
      files = await readdir(projectDir);
    } catch {
      continue;
    }

    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

    const handoffs = await Promise.all(
      jsonlFiles.map(async (f) => {
        const sessionId = f.replace('.jsonl', '');
        return extractHandoff(join(projectDir, f), sessionId, projectName);
      })
    );

    for (const h of handoffs) {
      if (h) results.push(h);
    }
  }

  // 종료 시각 기준 최신 순 정렬
  results.sort((a, b) => b.endedAt - a.endedAt);
  return results;
}
