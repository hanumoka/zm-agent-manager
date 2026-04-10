import { create } from 'zustand';
import type { ProjectGroup, ParsedSession, JsonlRecord } from '@shared/types';

interface SessionState {
  // 세션 목록
  groups: ProjectGroup[];
  isLoading: boolean;
  error: string | null;
  fetchSessions: () => Promise<void>;

  // 현재 선택된 세션
  currentSession: ParsedSession | null;
  isParsingSession: boolean;
  loadSession: (projectEncoded: string, sessionId: string) => Promise<void>;
  clearCurrentSession: () => void;

  // 실시간 감시
  addNewRecords: (records: JsonlRecord[]) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  groups: [],
  isLoading: false,
  error: null,
  currentSession: null,
  isParsingSession: false,

  fetchSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      // preload가 미로드된 경우(테스트 등)에도 명시적으로 에러 처리되도록 optional chaining + 가드
      const groups = (await window.api?.getSessions?.()) ?? [];
      set({ groups, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '세션 목록 조회 실패',
        isLoading: false,
      });
    }
  },

  loadSession: async (projectEncoded: string, sessionId: string) => {
    set({ isParsingSession: true, error: null });
    try {
      const parsed = await window.api?.parseSession?.(projectEncoded, sessionId);
      if (!parsed) {
        throw new Error('preload API를 사용할 수 없습니다');
      }
      set({ currentSession: parsed, isParsingSession: false });

      // 실시간 감시 시작
      await window.api?.watchSession?.(sessionId, projectEncoded);
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '세션 파싱 실패',
        isParsingSession: false,
      });
    }
  },

  clearCurrentSession: () => {
    const current = get().currentSession;
    if (current) {
      window.api?.unwatchSession?.(current.sessionId);
    }
    set({ currentSession: null });
  },

  addNewRecords: (records: JsonlRecord[]) => {
    const current = get().currentSession;
    if (!current) return;

    const newMessageCount =
      current.messageCount +
      records.filter((r) => r.type === 'user' || r.type === 'assistant').length;

    const newToolCount =
      current.toolCallCount +
      records
        .filter((r) => r.type === 'assistant')
        .reduce((acc, r) => {
          if (r.type === 'assistant' && r.message?.content) {
            return acc + r.message.content.filter((b) => b.type === 'tool_use').length;
          }
          return acc;
        }, 0);

    set({
      currentSession: {
        ...current,
        records: [...current.records, ...records],
        messageCount: newMessageCount,
        toolCallCount: newToolCount,
      },
    });
  },
}));
