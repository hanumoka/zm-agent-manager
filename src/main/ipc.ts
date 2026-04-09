import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/types';
import { scanAllSessions } from './session-scanner';

/**
 * IPC 핸들러 등록 — 렌더러에서 호출 가능한 API
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GET_SESSIONS, async () => {
    return scanAllSessions();
  });
}
