import { join } from 'path';
import { homedir } from 'os';
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/types';
import { scanAllSessions } from './session-scanner';
import { parseJsonlFile } from './jsonl-parser';
import { watchSession, unwatchSession } from './session-watcher';

const CLAUDE_DIR = join(homedir(), '.claude');

/**
 * IPC 핸들러 등록 — 렌더러에서 호출 가능한 API
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GET_SESSIONS, async () => {
    return scanAllSessions();
  });

  ipcMain.handle(
    IPC_CHANNELS.PARSE_SESSION,
    async (_event, projectEncoded: string, sessionId: string) => {
      const jsonlPath = join(CLAUDE_DIR, 'projects', projectEncoded, `${sessionId}.jsonl`);
      return parseJsonlFile(jsonlPath);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.WATCH_SESSION,
    async (_event, sessionId: string, projectEncoded: string) => {
      watchSession(sessionId, projectEncoded);
    }
  );

  ipcMain.handle(IPC_CHANNELS.UNWATCH_SESSION, async (_event, sessionId: string) => {
    unwatchSession(sessionId);
  });
}
