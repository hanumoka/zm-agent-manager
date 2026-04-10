import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import { IPC_CHANNELS } from '@shared/types';
import type {
  ProjectGroup,
  ParsedSession,
  JsonlRecord,
  AllTasksResult,
  CostSummary,
  SubagentInfo,
  DocInfo,
  SearchResponse,
  SearchFilters,
  BudgetSettings,
  StatsSummary,
} from '@shared/types';

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
  getCostSummary: (): Promise<CostSummary> => ipcRenderer.invoke(IPC_CHANNELS.GET_COST_SUMMARY),
  getSessionSubagents: (projectEncoded: string, sessionId: string): Promise<SubagentInfo[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SESSION_SUBAGENTS, projectEncoded, sessionId),
  getProjectDocs: (projectPath: string): Promise<DocInfo[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_PROJECT_DOCS, projectPath),
  searchSessions: (query: string, filters?: SearchFilters): Promise<SearchResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH_SESSIONS, query, filters),
  getStatsSummary: (): Promise<StatsSummary> => ipcRenderer.invoke(IPC_CHANNELS.GET_STATS_SUMMARY),
  getBudgetSettings: (): Promise<BudgetSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_BUDGET_SETTINGS),
  setBudgetSettings: (settings: BudgetSettings): Promise<BudgetSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_BUDGET_SETTINGS, settings),
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
