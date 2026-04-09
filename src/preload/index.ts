import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import { IPC_CHANNELS } from '@shared/types';
import type { ProjectGroup, ParsedSession } from '@shared/types';

// 앱 전용 API
const api = {
  getSessions: (): Promise<ProjectGroup[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_SESSIONS),
  parseSession: (projectEncoded: string, sessionId: string): Promise<ParsedSession> =>
    ipcRenderer.invoke(IPC_CHANNELS.PARSE_SESSION, projectEncoded, sessionId),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error (contextIsolation 비활성화 시 fallback)
  window.electron = electronAPI;
  // @ts-expect-error contextIsolation 비활성화 시 fallback
  window.api = api;
}
