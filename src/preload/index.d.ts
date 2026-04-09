import { ElectronAPI } from '@electron-toolkit/preload';
import type {
  ProjectGroup,
  ParsedSession,
  JsonlRecord,
  AllTasksResult,
  CostSummary,
  SubagentInfo,
  DocInfo,
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
