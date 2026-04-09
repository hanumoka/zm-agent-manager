import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import { IPC_CHANNELS } from '@shared/types';
import type { ProjectGroup, ParsedSession, JsonlRecord, AllTasksResult } from '@shared/types';

// 앱 전용 API
const api = {
  getSessions: (): Promise<ProjectGroup[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_SESSIONS),
  parseSession: (projectEncoded: string, sessionId: string): Promise<ParsedSession> =>
    ipcRenderer.invoke(IPC_CHANNELS.PARSE_SESSION, projectEncoded, sessionId),
  watchSession: (sessionId: string, projectEncoded: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.WATCH_SESSION, sessionId, projectEncoded),
  unwatchSession: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.UNWATCH_SESSION, sessionId),
  getAllTasks: (): Promise<AllTasksResult> => ipcRenderer.invoke(IPC_CHANNELS.GET_ALL_TASKS),
  onNewRecords: (
    callback: (data: { sessionId: string; records: JsonlRecord[] }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { sessionId: string; records: JsonlRecord[] }
    ): void => {
      callback(data);
    };
    ipcRenderer.on(IPC_CHANNELS.SESSION_NEW_RECORDS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SESSION_NEW_RECORDS, handler);
  },
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
