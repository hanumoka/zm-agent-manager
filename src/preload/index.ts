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
  SkillInfo,
  MemoryContent,
  AgentInfo,
  ConfigSummary,
  TaskMetadata,
  WorkflowDefinition,
  DocReview,
  NotificationSettings,
  NotificationHistory,
  NotificationHistoryEntry,
  FileVersionInfo,
  PlanInfo,
  ProjectSettings,
  KnownProject,
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
  getSkills: (): Promise<SkillInfo[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_SKILLS),
  getMemoryContent: (projectEncoded: string): Promise<MemoryContent> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_MEMORY_CONTENT, projectEncoded),
  getAgents: (): Promise<AgentInfo[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_AGENTS),
  getConfigSummary: (): Promise<ConfigSummary> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG_SUMMARY),
  getTaskMetadata: (taskId: string): Promise<TaskMetadata> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_TASK_METADATA, taskId),
  setTaskMetadata: (metadata: TaskMetadata): Promise<TaskMetadata> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_TASK_METADATA, metadata),
  getWorkflows: (): Promise<WorkflowDefinition[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_WORKFLOWS),
  setWorkflow: (workflow: WorkflowDefinition): Promise<WorkflowDefinition> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_WORKFLOW, workflow),
  deleteWorkflow: (name: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_WORKFLOW, name),
  getDocReview: (docPath: string): Promise<DocReview> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_DOC_REVIEW, docPath),
  setDocReview: (review: DocReview): Promise<DocReview> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_DOC_REVIEW, review),
  getNotificationSettings: (): Promise<NotificationSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_NOTIFICATION_SETTINGS),
  setNotificationSettings: (settings: NotificationSettings): Promise<NotificationSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_NOTIFICATION_SETTINGS, settings),
  getBudgetSettings: (): Promise<BudgetSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_BUDGET_SETTINGS),
  setBudgetSettings: (settings: BudgetSettings): Promise<BudgetSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_BUDGET_SETTINGS, settings),
  getNotificationHistory: (): Promise<NotificationHistory> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_NOTIFICATION_HISTORY),
  markNotificationRead: (id: string): Promise<NotificationHistoryEntry | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.MARK_NOTIFICATION_READ, id),
  clearNotificationHistory: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAR_NOTIFICATION_HISTORY),
  getFileVersions: (sessionId: string, projectEncoded: string): Promise<FileVersionInfo[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_FILE_VERSIONS, sessionId, projectEncoded),
  getFileContent: (sessionId: string, backupFileName: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_FILE_CONTENT, sessionId, backupFileName),
  getAllPlans: (): Promise<PlanInfo[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_ALL_PLANS),
  lintClaudeMd: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke(IPC_CHANNELS.LINT_CLAUDE_MD, projectPath),
  getSidebarSettings: (): Promise<{ items: { path: string; visible: boolean; order: number }[] }> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SIDEBAR_SETTINGS),
  setSidebarSettings: (
    settings: { items: { path: string; visible: boolean; order: number }[] }
  ): Promise<{ items: { path: string; visible: boolean; order: number }[] }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_SIDEBAR_SETTINGS, settings),
  getHandoffs: (): Promise<unknown[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_HANDOFFS),
  getProjectSettings: (): Promise<ProjectSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_PROJECT_SETTINGS),
  setProjectSettings: (settings: ProjectSettings): Promise<ProjectSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_PROJECT_SETTINGS, settings),
  getKnownProjects: (): Promise<KnownProject[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_KNOWN_PROJECTS),
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
