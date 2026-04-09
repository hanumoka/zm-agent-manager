import { contextBridge } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// contextBridge를 통해 렌더러에 API 노출
// Phase 1 M2에서 세션 관련 IPC 핸들러 추가 예정
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error (contextIsolation 비활성화 시 fallback)
  window.electron = electronAPI;
}
