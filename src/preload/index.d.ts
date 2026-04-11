import { ElectronAPI } from '@electron-toolkit/preload';
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
} from '@shared/types';

interface AppAPI {
  getSessions: () => Promise<ProjectGroup[]>;
  parseSession: (projectEncoded: string, sessionId: string) => Promise<ParsedSession>;
  watchSession: (sessionId: string, projectEncoded: string) => Promise<void>;
  unwatchSession: (sessionId: string) => Promise<void>;
  getAllTasks: () => Promise<AllTasksResult>;
  getCostSummary: () => Promise<CostSummary>;
  getSessionSubagents: (projectEncoded: string, sessionId: string) => Promise<SubagentInfo[]>;
  getProjectDocs: (projectPath: string) => Promise<DocInfo[]>;
  searchSessions: (query: string, filters?: SearchFilters) => Promise<SearchResponse>;
  getStatsSummary: () => Promise<StatsSummary>;
  getSkills: () => Promise<SkillInfo[]>;
  getMemoryContent: (projectEncoded: string) => Promise<MemoryContent>;
  getAgents: () => Promise<AgentInfo[]>;
  getConfigSummary: () => Promise<ConfigSummary>;
  getTaskMetadata: (taskId: string) => Promise<TaskMetadata>;
  setTaskMetadata: (metadata: TaskMetadata) => Promise<TaskMetadata>;
  getWorkflows: () => Promise<WorkflowDefinition[]>;
  setWorkflow: (workflow: WorkflowDefinition) => Promise<WorkflowDefinition>;
  deleteWorkflow: (name: string) => Promise<void>;
  getDocReview: (docPath: string) => Promise<DocReview>;
  setDocReview: (review: DocReview) => Promise<DocReview>;
  getNotificationSettings: () => Promise<NotificationSettings>;
  setNotificationSettings: (settings: NotificationSettings) => Promise<NotificationSettings>;
  getBudgetSettings: () => Promise<BudgetSettings>;
  setBudgetSettings: (settings: BudgetSettings) => Promise<BudgetSettings>;
  getNotificationHistory: () => Promise<NotificationHistory>;
  markNotificationRead: (id: string) => Promise<NotificationHistoryEntry | null>;
  clearNotificationHistory: () => Promise<void>;
  getFileVersions: (sessionId: string, projectEncoded: string) => Promise<FileVersionInfo[]>;
  getFileContent: (sessionId: string, backupFileName: string) => Promise<string | null>;
  getAllPlans: () => Promise<PlanInfo[]>;
  lintClaudeMd: (projectPath: string) => Promise<unknown>;
  getSidebarSettings: () => Promise<{
    items: { path: string; visible: boolean; order: number }[];
  }>;
  setSidebarSettings: (settings: {
    items: { path: string; visible: boolean; order: number }[];
  }) => Promise<{ items: { path: string; visible: boolean; order: number }[] }>;
  getHandoffs: () => Promise<unknown[]>;
  onNewRecords: (
    callback: (data: { sessionId: string; records: JsonlRecord[] }) => void
  ) => () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: AppAPI;
  }
}
