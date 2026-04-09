import { create } from 'zustand';
import type { ProjectGroup } from '@shared/types';

interface SessionState {
  groups: ProjectGroup[];
  isLoading: boolean;
  error: string | null;
  fetchSessions: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  groups: [],
  isLoading: false,
  error: null,

  fetchSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const groups = await window.api.getSessions();
      set({ groups, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '세션 목록 조회 실패',
        isLoading: false,
      });
    }
  },
}));
