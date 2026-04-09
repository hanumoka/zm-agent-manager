/**
 * 메인 프로세스와 렌더러 프로세스 간 공유 타입 정의
 */

// ─── IPC 채널 ───

export const IPC_CHANNELS = {
  GET_SESSIONS: 'sessions:get-all',
  GET_SESSION_DETAIL: 'sessions:get-detail',
  PARSE_SESSION: 'sessions:parse',
  WATCH_SESSION: 'sessions:watch',
  UNWATCH_SESSION: 'sessions:unwatch',
  SESSION_NEW_RECORDS: 'session:new-records',
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

// ─── JSONL 레코드 타입 ───

export type RecordType =
  | 'user'
  | 'assistant'
  | 'system'
  | 'file-history-snapshot'
  | 'permission-mode'
  | 'attachment'
  | 'queue-operation';

// 공통 필드 (user, assistant, system 공유)
export interface BaseRecord {
  type: RecordType;
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string | number;
  isSidechain: boolean;
  userType: string;
  entrypoint: string;
  cwd: string;
  version: string;
  gitBranch: string;
  slug?: string;
}

// ─── Content Block 타입 ───

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | unknown[];
}

export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock;

// ─── Usage ───

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

// ─── 개별 레코드 타입 ───

export interface UserRecord extends BaseRecord {
  type: 'user';
  message: {
    role: 'user';
    content: string | ContentBlock[];
  };
  promptId?: string;
  toolUseResult?: unknown;
}

export interface AssistantRecord extends BaseRecord {
  type: 'assistant';
  message: {
    role: 'assistant';
    content: ContentBlock[];
    model?: string;
    usage?: TokenUsage;
  };
  requestId?: string;
}

export interface SystemRecord extends BaseRecord {
  type: 'system';
  subtype: string;
  hookCount?: number;
  preventedContinuation?: boolean;
  stopReason?: string;
  hasOutput?: boolean;
  level?: string;
}

export interface FileHistorySnapshotRecord {
  type: 'file-history-snapshot';
  messageId?: string;
  isSnapshotUpdate?: boolean;
  snapshot?: Record<string, unknown>;
}

export interface PermissionModeRecord {
  type: 'permission-mode';
  permissionMode: string;
  sessionId: string;
}

export type JsonlRecord =
  | UserRecord
  | AssistantRecord
  | SystemRecord
  | FileHistorySnapshotRecord
  | PermissionModeRecord;

// ─── 파싱 결과 ───

export interface ParsedSession {
  sessionId: string;
  records: JsonlRecord[];
  messageCount: number;
  toolCallCount: number;
  lastActivity: number;
}
