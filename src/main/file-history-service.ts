import { createReadStream } from 'fs';
import { readFile, stat } from 'fs/promises';
import { createInterface } from 'readline';
import { join } from 'path';
import { homedir } from 'os';
import type { FileVersionInfo, TrackedFileBackup } from '@shared/types';

const CLAUDE_DIR = join(homedir(), '.claude');
const FILE_HISTORY_DIR = join(CLAUDE_DIR, 'file-history');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');

interface SnapshotData {
  trackedFileBackups: Record<string, TrackedFileBackup>;
}

/**
 * JSONL에서 file-history-snapshot 레코드를 추출하여 파일별 버전 목록 반환.
 */
export async function getFileVersions(
  sessionId: string,
  projectEncoded: string
): Promise<FileVersionInfo[]> {
  const jsonlPath = join(PROJECTS_DIR, projectEncoded, `${sessionId}.jsonl`);

  try {
    await stat(jsonlPath);
  } catch {
    return [];
  }

  // 파일별 최신 버전 추적
  const fileMap = new Map<string, Map<number, { backupFileName: string | null; backupTime: string }>>();

  const stream = createReadStream(jsonlPath, { encoding: 'utf-8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      if (!line.includes('file-history-snapshot')) continue;

      try {
        const raw = JSON.parse(line) as Record<string, unknown>;
        if (raw.type !== 'file-history-snapshot') continue;

        const snapshot = raw.snapshot as SnapshotData | undefined;
        if (!snapshot?.trackedFileBackups) continue;

        for (const [filePath, backup] of Object.entries(snapshot.trackedFileBackups)) {
          if (!fileMap.has(filePath)) fileMap.set(filePath, new Map());
          const versions = fileMap.get(filePath)!;
          // 같은 버전은 덮어쓰기 (최신 snapshot의 데이터 사용)
          versions.set(backup.version, {
            backupFileName: backup.backupFileName,
            backupTime: backup.backupTime,
          });
        }
      } catch {
        // 잘못된 JSON 라인 스킵
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  // Map → FileVersionInfo 배열
  const result: FileVersionInfo[] = [];
  for (const [filePath, versions] of fileMap) {
    const sorted = [...versions.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([version, data]) => ({
        version,
        backupFileName: data.backupFileName,
        backupTime: data.backupTime,
      }));
    result.push({ filePath, versions: sorted });
  }

  return result.sort((a, b) => a.filePath.localeCompare(b.filePath));
}

/**
 * 백업 파일 내용 읽기.
 * ~/.claude/file-history/{sessionId}/{backupFileName}
 */
export async function getFileBackupContent(
  sessionId: string,
  backupFileName: string
): Promise<string | null> {
  const filePath = join(FILE_HISTORY_DIR, sessionId, backupFileName);
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * 세션의 file-history 디렉토리 존재 여부 확인.
 */
export async function hasFileHistory(sessionId: string): Promise<boolean> {
  try {
    const dir = join(FILE_HISTORY_DIR, sessionId);
    const s = await stat(dir);
    return s.isDirectory();
  } catch {
    return false;
  }
}
