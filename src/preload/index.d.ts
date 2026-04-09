import { ElectronAPI } from '@electron-toolkit/preload';
import type { ProjectGroup, ParsedSession } from '@shared/types';

interface AppAPI {
  getSessions: () => Promise<ProjectGroup[]>;
  parseSession: (projectEncoded: string, sessionId: string) => Promise<ParsedSession>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: AppAPI;
  }
}
