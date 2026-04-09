/**
 * 메인 프로세스와 렌더러 프로세스 간 공유 타입 정의
 */

// ─── IPC 채널 ───

export const IPC_CHANNELS = {
  GET_SESSIONS: 'sessions:get-all',
  GET_SESSION_DETAIL: 'sessions:get-detail',
} as const;

// ─── history.jsonl 레코드 ───

export interface HistoryEntry {
  display: string;
  pastedContents: Record<string, unknown>;
  timestamp: number;
  project: string;
  sessionId: string;
}

// ─── sessions/{pid}.json (활성 세션) ───

export interface ActiveSessionInfo {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  kind: string;
  entrypoint: string;
  name?: string;
}

// ─── 세션 메타데이터 (렌더러에 전달) ───

export interface SessionMeta {
  sessionId: string;
  projectPath: string;
  projectName: string;
  lastActivity: number;
  firstMessage: string;
  messageCount: number;
  isActive: boolean;
}

// ─── 프로젝트별 그룹 ───

export interface ProjectGroup {
  projectPath: string;
  projectName: string;
  sessions: SessionMeta[];
}
