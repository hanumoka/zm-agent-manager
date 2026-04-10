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
  GET_BUDGET_SETTINGS: 'budget:get-settings',
  SET_BUDGET_SETTINGS: 'budget:set-settings',
  GET_STATS_SUMMARY: 'stats:get-summary',
  GET_SKILLS: 'skills:get-all',
  GET_MEMORY_CONTENT: 'memory:get-content',
  GET_AGENTS: 'agents:get-all',
  GET_CONFIG_SUMMARY: 'config:get-summary',
  GET_TASK_METADATA: 'task-meta:get',
  SET_TASK_METADATA: 'task-meta:set',
  GET_WORKFLOWS: 'workflows:get-all',
  SET_WORKFLOW: 'workflows:set',
  DELETE_WORKFLOW: 'workflows:delete',
  GET_DOC_REVIEW: 'doc-review:get',
  SET_DOC_REVIEW: 'doc-review:set',
  GET_NOTIFICATION_SETTINGS: 'notifications:get-settings',
  SET_NOTIFICATION_SETTINGS: 'notifications:set-settings',
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
  /** history.jsonl 기반 사용자 프롬프트 입력 횟수. JSONL 레코드 수와 다르다 (`ParsedSession.messageCount` 참조). */
  promptCount: number;
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

// ─── 스킬 모니터 (F17) ───

export type SkillScope = 'project' | 'global' | 'plugin';

export interface SkillInfo {
  name: string;
  description: string;
  scope: SkillScope;
  filePath: string;
  sizeBytes: number;
  lastModified: number;
  /** allowed-tools 프론트매터를 공백 구분으로 파싱한 배열 */
  allowedTools: string[];
  /** model 프론트매터 (없을 수 있음) */
  model?: string;
  /** disable-model-invocation: true 일 때만 true */
  disableModelInvocation: boolean;
}

// ─── 태스크 워크플로우 (F14) ───

export type TaskSeverity = 'blocking' | 'important' | 'suggestion';
export type TaskType = 'fix' | 'change' | 'question' | 'approve';

export interface TaskMetadata {
  taskId: string;
  severity?: TaskSeverity;
  type?: TaskType;
  /** 워크플로우 이름 (어떤 워크플로우를 사용하는지) */
  workflowName?: string;
  /** 현재 워크플로우 단계 */
  workflowStage?: string;
  updatedAt: number;
}

export interface WorkflowDefinition {
  /** 워크플로우 고유 이름 (파일명으로도 사용) */
  name: string;
  /** 표시명 */
  displayName: string;
  /** 순서가 있는 단계 목록 */
  stages: string[];
  /** 생성 시각 */
  createdAt: number;
}

// ─── 문서 리뷰 상태 (F15) ───

export type DocReviewStatus = 'pending' | 'approved' | 'rejected' | 'commented';

export interface DocReview {
  /** 문서 상대 경로 (식별자) */
  docPath: string;
  status: DocReviewStatus;
  /** 코멘트 (rejected/commented 시) */
  comment?: string;
  updatedAt: number;
}

// ─── 알림 설정 (F16) ───

export interface NotificationSettings {
  /** 비용 임계 알림 ON/OFF */
  budgetAlert: boolean;
  /** 문서 변경 알림 ON/OFF */
  docChange: boolean;
  /** 세션 시작/종료 알림 ON/OFF */
  sessionLifecycle: boolean;
  /** 태스크 완료 알림 ON/OFF */
  taskComplete: boolean;
}

// ─── Config 모니터 (F20) ───

export interface HookEntry {
  /** 이벤트 타입 (PreToolUse, PostToolUse, Stop, Notification 등) */
  event: string;
  /** matcher 패턴 (예: "Edit|Write") */
  matcher: string;
  /** 훅 타입 (command, prompt, agent, http) */
  type: string;
  /** command/prompt/agent 내용 */
  command: string;
}

export interface RuleFile {
  name: string;
  filePath: string;
  sizeBytes: number;
  lastModified: number;
}

export interface McpServer {
  name: string;
  command: string;
  args: string[];
}

export interface ConfigSummary {
  hooks: HookEntry[];
  rules: RuleFile[];
  mcpServers: McpServer[];
  /** permissions.allow 목록 */
  permissionsAllow: string[];
  /** permissions.deny 목록 */
  permissionsDeny: string[];
}

// ─── 에이전트 모니터 (F18) ───

export interface AgentInfo {
  name: string;
  description: string;
  scope: SkillScope;
  filePath: string;
  sizeBytes: number;
  lastModified: number;
  /** tools 프론트매터 (쉼표/공백 구분 배열) */
  tools: string[];
  /** model 프론트매터 (없을 수 있음) */
  model?: string;
}

// ─── 메모리 뷰어 (F19) ───

export interface MemoryContent {
  /** 프로젝트 인코딩 경로 */
  projectEncoded: string;
  /** 프로젝트 이름 */
  projectName: string;
  /** MEMORY.md 파일 전체 텍스트. 파일이 없으면 null. */
  content: string | null;
  /** 라인 수 (0 if null) */
  lineCount: number;
  /** 파일 크기 (bytes, 0 if null) */
  sizeBytes: number;
  /** MEMORY.md 절대 경로 */
  filePath: string;
  /** 200줄 초과 시 true — Claude 시스템 프롬프트에서 잘림 경고 */
  exceedsLimit: boolean;
}

// ─── 세션 통계 (F8) ───

export interface DailyActivity {
  /** 로컬 시각 기준 "YYYY-MM-DD" */
  date: string;
  /** 해당 일자의 user+assistant 레코드 수 */
  messageCount: number;
  /** 해당 일자에 활성이었던 고유 세션 수 */
  sessionCount: number;
  /** 해당 일자의 도구 호출 수 (assistant tool_use 블록) */
  toolCallCount: number;
}

export interface HeatmapCell {
  /** 0=Sun, 1=Mon, ..., 6=Sat (로컬 시각 기준) */
  dayOfWeek: number;
  /** 0..23 (로컬 시각 기준) */
  hour: number;
  /** 해당 슬롯의 사용자 프롬프트(history 엔트리) 수 */
  count: number;
}

export interface ProjectStats {
  projectName: string;
  projectPath: string;
  sessionCount: number;
  /** 해당 프로젝트 전체 세션의 user+assistant 레코드 합계 */
  messageCount: number;
  /** 해당 프로젝트 전체 세션의 도구 호출 합계 */
  toolCallCount: number;
  /** 해당 프로젝트 비용 (USD, 모델 가격 테이블 기반) */
  cost: number;
}

export interface ModelTokenUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
}

export interface StatsSummary {
  /** 고유 세션 수 */
  totalSessions: number;
  /** 전체 user+assistant 레코드 수 */
  totalMessages: number;
  /** 전체 토큰 (input+output+cacheRead+cacheWrite) */
  totalTokens: number;
  /** 전체 도구 호출 수 */
  totalToolCalls: number;
  /** 최근 30일 일별 활동 (정렬 오름차순) */
  dailyActivity: DailyActivity[];
  /** 7×24 히트맵 */
  heatmap: HeatmapCell[];
  /** 프로젝트별 집계 (cost 내림차순) */
  byProject: ProjectStats[];
  /** 모델별 토큰 합계 (total 내림차순) */
  byModel: ModelTokenUsage[];
}

// ─── 예산 설정 (F13) ───

export interface BudgetSettings {
  /** 일별 예산 (USD). 0/null이면 비활성화 */
  dailyUsd: number | null;
  /** 월별 예산 (USD). 0/null이면 비활성화 */
  monthlyUsd: number | null;
  /** 알림 임계 비율 (0~100). 기본 80 */
  alertPercent: number;
  /**
   * 마지막 알림 발송 키 (중복 방지). 형식:
   * - 일별: `daily-YYYY-MM-DD-{warn|exceed}`
   * - 월별: `monthly-YYYY-MM-{warn|exceed}`
   * 키가 일치하면 같은 임계의 추가 알림을 건너뛴다.
   */
  lastNotifiedKeys: string[];
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

export interface SearchFilters {
  /** 프로젝트명으로 제한 (정확 일치). 미지정 시 전체 프로젝트 검색. */
  projectName?: string;
  /** 시작 시각(epoch ms, inclusive). 미지정 시 제한 없음. */
  dateFromMs?: number;
  /** 종료 시각(epoch ms, inclusive). 미지정 시 제한 없음. */
  dateToMs?: number;
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
