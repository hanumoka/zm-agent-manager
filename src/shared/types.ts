/**
 * 메인 프로세스와 렌더러 프로세스 간 공유 타입 정의
 */

// ─── 유틸 함수 ───

/**
 * 프로젝트 경로를 Claude 디렉토리 인코딩 형식으로 변환
 * /Users/hanumoka/projects/zm-agent-manager → -Users-hanumoka-projects-zm-agent-manager
 */
export function encodeProjectPath(projectPath: string): string {
  return projectPath.replace(/\//g, '-');
}

// ─── IPC 채널 ───

export const IPC_CHANNELS = {
  GET_SESSIONS: 'sessions:get-all',
  PARSE_SESSION: 'sessions:parse',
  WATCH_SESSION: 'sessions:watch',
  UNWATCH_SESSION: 'sessions:unwatch',
  SESSION_NEW_RECORDS: 'session:new-records',
  GET_ALL_TASKS: 'tasks:get-all',
  GET_COST_SUMMARY: 'cost:get-summary',
  GET_SESSION_SUBAGENTS: 'sessions:get-subagents',
  GET_PROJECT_DOCS: 'docs:get-project',
  SEARCH_SESSIONS: 'search:sessions',
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

// ─── 태스크 보드 ───

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'deleted';

export interface TaskEvent {
  type: 'create' | 'update';
  timestamp: string | number;
  sessionId: string;
  status?: TaskStatus;
}

export interface TaskInfo {
  taskId: string;
  subject: string;
  description: string;
  activeForm: string;
  status: TaskStatus;
  sessionId: string;
  projectName: string;
  createdAt: string | number;
  events: TaskEvent[];
}

export interface AllTasksResult {
  tasks: TaskInfo[];
}

// ─── 비용 추적 ───

export interface ModelCost {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: number;
  requestCount: number;
}

export interface DailyCost {
  date: string;
  cost: number;
  requestCount: number;
}

export interface CostSummary {
  totalCost: number;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byModel: ModelCost[];
  byDay: DailyCost[];
}

// ─── 검색 ───

export interface SearchResult {
  sessionId: string;
  projectName: string;
  projectPath: string;
  matchText: string;
  recordType: 'user' | 'assistant';
  timestamp: string | number;
  toolName?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalMatches: number;
}

// ─── 문서 인벤토리 ───

export interface DocInfo {
  name: string;
  path: string;
  relativePath: string;
  category: string;
  sizeBytes: number;
  lineCount: number;
  lastModified: number;
}

// ─── 서브에이전트 ───

export interface SubagentInfo {
  agentId: string;
  agentType: string;
  description: string;
  messageCount: number;
  toolCallCount: number;
  records: JsonlRecord[];
  timestamp: number;
}

// ─── 파싱 결과 ───

export interface ParsedSession {
  sessionId: string;
  records: JsonlRecord[];
  messageCount: number;
  toolCallCount: number;
  lastActivity: number;
}
