import { ElectronAPI } from '@electron-toolkit/preload';
import type { ProjectGroup } from '@shared/types';

interface AppAPI {
  getSessions: () => Promise<ProjectGroup[]>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: AppAPI;
  }
}
