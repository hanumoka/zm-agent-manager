import { join } from 'path';
import { homedir } from 'os';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import type { HistoryEntry } from '@shared/types';
import { encodeProjectPath } from '@shared/types';

const DEFAULT_HISTORY_FILE = join(homedir(), '.claude', 'history.jsonl');

export interface HistoryParseResult {
  sessionMap: Map<string, HistoryEntry[]>;
  /** 인코딩된 디렉토리명 → 실제 프로젝트 경로 */
  projectPathMap: Map<string, string>;
}

/**
 * history.jsonl 파싱 — 세션별 메시지 맵 + 프로젝트 경로 맵 생성
 * session-scanner와 task-scanner에서 공유
 *
 * @param historyFile 테스트용 옵션. 기본값은 `~/.claude/history.jsonl`
 */
export async function parseHistoryFile(
  historyFile: string = DEFAULT_HISTORY_FILE
): Promise<HistoryParseResult> {
  const sessionMap = new Map<string, HistoryEntry[]>();
  const projectPathMap = new Map<string, string>();

  let stream: ReturnType<typeof createReadStream> | null = null;
  let rl: ReturnType<typeof createInterface> | null = null;

  try {
    stream = createReadStream(historyFile, { encoding: 'utf-8' });
    rl = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as HistoryEntry;
        const existing = sessionMap.get(entry.sessionId) ?? [];
        existing.push(entry);
        sessionMap.set(entry.sessionId, existing);

        if (entry.project) {
          const encoded = encodeProjectPath(entry.project);
          projectPathMap.set(encoded, entry.project);
        }
      } catch {
        // 잘못된 JSON 라인 스킵
      }
    }
  } catch {
    // history.jsonl이 없으면 빈 맵 반환
  } finally {
    rl?.close();
    stream?.destroy();
  }

  return { sessionMap, projectPathMap };
}
