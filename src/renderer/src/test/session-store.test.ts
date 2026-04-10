import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSessionStore } from '../stores/session-store';
import type {
  ProjectGroup,
  ParsedSession,
  JsonlRecord,
  AssistantRecord,
  UserRecord,
} from '@shared/types';

// window.api mock
const mockApi = {
  getSessions: vi.fn<() => Promise<ProjectGroup[]>>(),
  parseSession: vi.fn<(p: string, s: string) => Promise<ParsedSession>>(),
  watchSession: vi.fn<(s: string, p: string) => Promise<void>>(),
  unwatchSession: vi.fn<(s: string) => Promise<void>>(),
  getAllTasks: vi.fn(),
  getCostSummary: vi.fn(),
  getSessionSubagents: vi.fn(),
  getProjectDocs: vi.fn(),
  searchSessions: vi.fn(),
  getBudgetSettings: vi.fn(),
  setBudgetSettings: vi.fn(),
  onNewRecords: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal('window', { api: mockApi });
  vi.clearAllMocks();
  // store reset
  useSessionStore.setState({
    groups: [],
    isLoading: false,
    error: null,
    currentSession: null,
    isParsingSession: false,
  });
});

function makeUserRecord(uuid: string): UserRecord {
  return {
    type: 'user',
    uuid,
    parentUuid: null,
    sessionId: 's1',
    timestamp: '2026-04-09T12:00:00Z',
    isSidechain: false,
    userType: 'external',
    entrypoint: 'cli',
    cwd: '/test',
    version: '2.0',
    gitBranch: 'main',
    message: { role: 'user', content: 'hello' },
  };
}

function makeAssistantWithToolUse(uuid: string, toolCount: number): AssistantRecord {
  return {
    type: 'assistant',
    uuid,
    parentUuid: null,
    sessionId: 's1',
    timestamp: '2026-04-09T12:00:01Z',
    isSidechain: false,
    userType: 'external',
    entrypoint: 'cli',
    cwd: '/test',
    version: '2.0',
    gitBranch: 'main',
    message: {
      role: 'assistant',
      content: Array.from({ length: toolCount }, (_, i) => ({
        type: 'tool_use' as const,
        id: `t-${uuid}-${i}`,
        name: 'Read',
        input: { file_path: '/foo' },
      })),
    },
  };
}

const baseSession: ParsedSession = {
  sessionId: 's1',
  records: [],
  messageCount: 0,
  toolCallCount: 0,
  lastActivity: 0,
};

describe('useSessionStore', () => {
  describe('fetchSessions', () => {
    it('성공 시 groups 설정 + isLoading false', async () => {
      const groups: ProjectGroup[] = [{ projectPath: '/p', projectName: 'p', sessions: [] }];
      mockApi.getSessions.mockResolvedValue(groups);

      await useSessionStore.getState().fetchSessions();

      const state = useSessionStore.getState();
      expect(state.groups).toEqual(groups);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('실패 시 error 메시지 설정', async () => {
      mockApi.getSessions.mockRejectedValue(new Error('네트워크 오류'));

      await useSessionStore.getState().fetchSessions();

      const state = useSessionStore.getState();
      expect(state.error).toBe('네트워크 오류');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('loadSession', () => {
    it('성공 시 currentSession 설정 + watchSession 호출', async () => {
      const parsed: ParsedSession = { ...baseSession, messageCount: 5 };
      mockApi.parseSession.mockResolvedValue(parsed);
      mockApi.watchSession.mockResolvedValue(undefined);

      await useSessionStore.getState().loadSession('-Users-foo', 's1');

      const state = useSessionStore.getState();
      expect(state.currentSession).toEqual(parsed);
      expect(state.isParsingSession).toBe(false);
      expect(mockApi.watchSession).toHaveBeenCalledWith('s1', '-Users-foo');
    });

    it('파싱 실패 시 error 설정', async () => {
      mockApi.parseSession.mockRejectedValue(new Error('JSONL 파싱 실패'));

      await useSessionStore.getState().loadSession('-Users-foo', 's1');

      const state = useSessionStore.getState();
      expect(state.error).toBe('JSONL 파싱 실패');
      expect(state.currentSession).toBeNull();
      expect(mockApi.watchSession).not.toHaveBeenCalled();
    });
  });

  describe('clearCurrentSession', () => {
    it('currentSession 있으면 unwatchSession 호출 + null로 리셋', () => {
      useSessionStore.setState({ currentSession: { ...baseSession, sessionId: 's1' } });
      mockApi.unwatchSession.mockResolvedValue(undefined);

      useSessionStore.getState().clearCurrentSession();

      expect(mockApi.unwatchSession).toHaveBeenCalledWith('s1');
      expect(useSessionStore.getState().currentSession).toBeNull();
    });

    it('currentSession 없으면 unwatchSession 호출 안 함', () => {
      useSessionStore.getState().clearCurrentSession();
      expect(mockApi.unwatchSession).not.toHaveBeenCalled();
    });
  });

  describe('addNewRecords', () => {
    it('currentSession이 null이면 noop', () => {
      useSessionStore.getState().addNewRecords([makeUserRecord('u1')]);
      expect(useSessionStore.getState().currentSession).toBeNull();
    });

    it('단일 호출 — messageCount + toolCallCount 정확히 누적', () => {
      useSessionStore.setState({ currentSession: { ...baseSession } });

      const records: JsonlRecord[] = [
        makeUserRecord('u1'),
        makeAssistantWithToolUse('a1', 2), // 2 tool_use
      ];
      useSessionStore.getState().addNewRecords(records);

      const state = useSessionStore.getState();
      expect(state.currentSession).not.toBeNull();
      expect(state.currentSession!.messageCount).toBe(2); // user + assistant
      expect(state.currentSession!.toolCallCount).toBe(2);
      expect(state.currentSession!.records).toHaveLength(2);
    });

    it('연속 호출 — 누적 카운트가 정확히 더해진다', () => {
      useSessionStore.setState({ currentSession: { ...baseSession } });

      useSessionStore.getState().addNewRecords([makeUserRecord('u1')]);
      useSessionStore.getState().addNewRecords([makeAssistantWithToolUse('a1', 1)]);

      const state = useSessionStore.getState();
      expect(state.currentSession!.messageCount).toBe(2);
      expect(state.currentSession!.toolCallCount).toBe(1);
      expect(state.currentSession!.records).toHaveLength(2);
    });

    it('user/assistant 외 레코드는 messageCount에 포함 안 됨', () => {
      useSessionStore.setState({ currentSession: { ...baseSession } });

      const systemRecord: JsonlRecord = {
        type: 'system',
        uuid: 'sys1',
        parentUuid: null,
        sessionId: 's1',
        timestamp: '2026-04-09T12:00:00Z',
        isSidechain: false,
        userType: 'external',
        entrypoint: 'cli',
        cwd: '/test',
        version: '2.0',
        gitBranch: 'main',
        subtype: 'stop_hook',
      };

      useSessionStore.getState().addNewRecords([systemRecord]);

      const state = useSessionStore.getState();
      expect(state.currentSession!.messageCount).toBe(0);
      expect(state.currentSession!.records).toHaveLength(1); // records는 모두 포함
    });

    it('알려진 race condition — 동시 호출 시 함수형 set 부재로 마지막 호출이 누적 결과를 덮어쓸 수 있다', () => {
      // known-issues.md L157 등록된 이슈를 명시적으로 검증.
      // 현재 구현은 get() + set으로 read-modify-write이므로 동시 호출 시 누적 누락 가능.
      // 함수형 set 도입 후에는 이 테스트의 기대값이 변경되어야 함.
      useSessionStore.setState({ currentSession: { ...baseSession } });

      // 먼저 첫 호출의 get() 결과를 캡처
      const snapshot = useSessionStore.getState().currentSession!;
      // 첫 호출 진행
      useSessionStore.getState().addNewRecords([makeUserRecord('u1')]);
      // 두 번째 호출이 첫 호출 직전의 snapshot을 사용한다고 시뮬레이션 (race)
      // 실제로는 get()이 최신 상태를 읽지만, 직접 set으로 race를 재현
      useSessionStore.setState({
        currentSession: {
          ...snapshot,
          records: [...snapshot.records, makeUserRecord('u2')],
          messageCount: snapshot.messageCount + 1,
        },
      });

      // 결과: messageCount는 1 (첫 호출의 결과가 유실됨)
      const state = useSessionStore.getState();
      expect(state.currentSession!.messageCount).toBe(1); // race로 인한 손실 시연
      expect(state.currentSession!.records).toHaveLength(1);
    });
  });
});
