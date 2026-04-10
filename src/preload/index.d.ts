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
  getBudgetSettings: () => Promise<BudgetSettings>;
  setBudgetSettings: (settings: BudgetSettings) => Promise<BudgetSettings>;
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
