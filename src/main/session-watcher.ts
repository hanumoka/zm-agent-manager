import { watch } from 'chokidar';
import { createReadStream, statSync } from 'fs';
import { createInterface } from 'readline';
import { join } from 'path';
import { homedir } from 'os';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@shared/types';
import type { JsonlRecord } from '@shared/types';

const PROJECTS_DIR = join(homedir(), '.claude', 'projects');

// 감시 중인 파일별 읽은 바이트 위치 추적
const fileOffsets = new Map<string, number>();

// 감시 대상 세션 목록 (sessionId → 파일 경로)
const watchedSessions = new Map<string, string>();

// chokidar 인스턴스
let watcher: ReturnType<typeof watch> | null = null;

/**
 * JSONL 파일에서 마지막으로 읽은 위치 이후의 새 라인만 파싱
 */
async function parseNewLines(filePath: string): Promise<JsonlRecord[]> {
  const currentOffset = fileOffsets.get(filePath) ?? 0;

  let fileSize: number;
  try {
    fileSize = statSync(filePath).size;
  } catch {
    return [];
  }

  // 파일이 줄어들었으면 (truncate) 처음부터 다시 읽기
  const startOffset = fileSize < currentOffset ? 0 : currentOffset;

  if (fileSize <= startOffset) return [];

  const records: JsonlRecord[] = [];
  const stream = createReadStream(filePath, {
    encoding: 'utf-8',
    start: startOffset,
  });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const raw = JSON.parse(line) as Record<string, unknown>;
      const type = raw.type as string;
      if (type === 'user' || type === 'assistant' || type === 'system') {
        records.push(raw as unknown as JsonlRecord);
      }
    } catch {
      // 잘못된 라인 스킵
    }
  }

  fileOffsets.set(filePath, fileSize);
  return records;
}

/**
 * 렌더러로 새 레코드 이벤트 전달
 */
function sendToRenderer(channel: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}

/**
 * 특정 세션 감시 등록
 */
export function watchSession(sessionId: string, projectEncoded: string): void {
  const filePath = join(PROJECTS_DIR, projectEncoded, `${sessionId}.jsonl`);

  if (watchedSessions.has(sessionId)) return;

  watchedSessions.set(sessionId, filePath);

  // 현재 파일 크기를 초기 오프셋으로 설정 (기존 내용은 이미 로드됨)
  try {
    const size = statSync(filePath).size;
    fileOffsets.set(filePath, size);
  } catch {
    fileOffsets.set(filePath, 0);
  }

  // watcher에 파일 추가
  if (watcher) {
    watcher.add(filePath);
  }
}

/**
 * 특정 세션 감시 해제
 */
export function unwatchSession(sessionId: string): void {
  const filePath = watchedSessions.get(sessionId);
  if (!filePath) return;

  watchedSessions.delete(sessionId);
  fileOffsets.delete(filePath);

  if (watcher) {
    watcher.unwatch(filePath);
  }
}

/**
 * 전체 파일 감시 시스템 초기화
 */
export function initWatcher(): void {
  // 활성 세션 디렉토리 감시 (새 JSONL 파일 생성 감지)
  watcher = watch([], {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 100,
    },
  });

  watcher.on('change', async (filePath) => {
    const newRecords = await parseNewLines(filePath);
    if (newRecords.length > 0) {
      // 해당 세션 ID 찾기
      const sessionId = [...watchedSessions.entries()].find(([, path]) => path === filePath)?.[0];

      if (sessionId) {
        sendToRenderer(IPC_CHANNELS.SESSION_NEW_RECORDS, {
          sessionId,
          records: newRecords,
        });
      }
    }
  });
}

/**
 * 감시 시스템 종료
 */
export async function stopWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
  fileOffsets.clear();
  watchedSessions.clear();
}
