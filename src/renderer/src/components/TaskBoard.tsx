import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pickLatestPlanPerProject } from '@/lib/plan-utils';
import {
  ClipboardList,
  Loader2,
  CheckCircle2,
  Clock,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils';
import { useSessionStore } from '@/stores/session-store';
import type { PlanInfo } from '@shared/types';
import ReactMarkdown from 'react-markdown';
import type {
  TaskInfo,
  TaskStatus,
  TaskSeverity,
  TaskType,
  TaskMetadata,
  WorkflowDefinition,
} from '@shared/types';

// ─── 상수 ───

const LANE_CONFIG: { status: TaskStatus; label: string; color: string; icon: React.ElementType }[] =
  [
    { status: 'pending', label: 'Pending', color: 'text-accent-yellow', icon: Clock },
    { status: 'in_progress', label: 'In Progress', color: 'text-primary', icon: Loader2 },
    { status: 'completed', label: 'Completed', color: 'text-accent-green', icon: CheckCircle2 },
  ];

// ─── TaskCard ───

interface TaskCardProps {
  task: TaskInfo;
}

// ─── 심각도/유형 배지 + 셀렉트 ───

const SEVERITY_CONFIG: Record<TaskSeverity, { label: string; color: string }> = {
  blocking: { label: 'Blocking', color: 'text-destructive bg-destructive/10' },
  important: { label: 'Important', color: 'text-accent-orange bg-accent-orange/10' },
  suggestion: { label: 'Suggestion', color: 'text-muted-foreground bg-muted' },
};

const TYPE_CONFIG: Record<TaskType, { label: string; color: string }> = {
  fix: { label: 'Fix', color: 'text-destructive bg-destructive/10' },
  change: { label: 'Change', color: 'text-primary bg-primary/10' },
  question: { label: 'Question', color: 'text-accent-yellow bg-accent-yellow/10' },
  approve: { label: 'Approve', color: 'text-accent-green bg-accent-green/10' },
};

function SeverityBadge({ severity }: { severity?: TaskSeverity }): React.JSX.Element | null {
  if (!severity) return null;
  const { label, color } = SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${color}`}>
      {label}
    </span>
  );
}

function TypeBadge({ type }: { type?: TaskType }): React.JSX.Element | null {
  if (!type) return null;
  const { label, color } = TYPE_CONFIG[type];
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${color}`}>
      {label}
    </span>
  );
}

/**
 * 칸반 카드 — 심각도/유형 메타데이터 지원.
 */
const TaskCard = memo(function TaskCard({ task }: TaskCardProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [meta, setMeta] = useState<TaskMetadata | null>(null);

  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);

  // expanded 될 때 메타데이터 + 워크플로우 목록 로드
  useEffect(() => {
    if (!expanded) return;
    let mounted = true;
    window.api?.getTaskMetadata?.(task.taskId)?.then((m) => {
      if (mounted) setMeta(m);
    });
    window.api?.getWorkflows?.()?.then((wfs) => {
      if (mounted) setWorkflows(wfs);
    });
    return () => {
      mounted = false;
    };
  }, [expanded, task.taskId]);

  const handleMetaChange = useCallback(
    async (field: 'severity' | 'type' | 'workflowName' | 'workflowStage', value: string) => {
      const next: TaskMetadata = {
        taskId: task.taskId,
        ...meta,
        [field]: value || undefined,
        updatedAt: Date.now(),
      };
      // 워크플로우 변경 시 단계 초기화
      if (field === 'workflowName') {
        next.workflowStage = undefined;
      }
      try {
        const saved = await window.api?.setTaskMetadata?.(next);
        if (saved) setMeta(saved);
      } catch {
        // 실패 시 무음
      }
    },
    [task.taskId, meta]
  );

  // 선택된 워크플로우의 단계 목록
  const selectedWorkflow = workflows.find((w) => w.name === meta?.workflowName);

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-start gap-2 w-full text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-medium text-foreground leading-snug">{task.subject}</p>
            <SeverityBadge severity={meta?.severity} />
            <TypeBadge type={meta?.type} />
            {meta?.workflowStage && (
              <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium text-primary bg-primary/10">
                {meta.workflowStage}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{task.projectName}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{formatTimeAgo(task.createdAt)}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-2 pl-5.5 space-y-2">
          {task.description && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{task.description}</p>
          )}
          {/* 심각도/유형 셀렉트 */}
          <div className="flex gap-2 text-xs">
            <select
              value={meta?.severity ?? ''}
              onChange={(e) => handleMetaChange('severity', e.target.value)}
              className="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground outline-none"
            >
              <option value="">심각도 —</option>
              <option value="blocking">Blocking</option>
              <option value="important">Important</option>
              <option value="suggestion">Suggestion</option>
            </select>
            <select
              value={meta?.type ?? ''}
              onChange={(e) => handleMetaChange('type', e.target.value)}
              className="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground outline-none"
            >
              <option value="">유형 —</option>
              <option value="fix">Fix</option>
              <option value="change">Change</option>
              <option value="question">Question</option>
              <option value="approve">Approve</option>
            </select>
          </div>
          {/* 워크플로우/단계 */}
          <div className="flex gap-2 text-xs">
            <select
              value={meta?.workflowName ?? ''}
              onChange={(e) => handleMetaChange('workflowName', e.target.value)}
              className="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground outline-none"
            >
              <option value="">워크플로우 —</option>
              {workflows.map((w) => (
                <option key={w.name} value={w.name}>
                  {w.displayName}
                </option>
              ))}
            </select>
            {selectedWorkflow && (
              <select
                value={meta?.workflowStage ?? ''}
                onChange={(e) => handleMetaChange('workflowStage', e.target.value)}
                className="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground outline-none"
              >
                <option value="">단계 —</option>
                {selectedWorkflow.stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            )}
          </div>
          {/* 상태 변경 이력 */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">상태 이력</p>
            {task.events.map((event, i) => {
              return (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-16 shrink-0">{event.type === 'create' ? '생성' : '변경'}</span>
                  <StatusBadge status={event.status ?? 'pending'} />
                  <span>{formatTimeAgo(event.timestamp)}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            세션: {task.sessionId.slice(0, 8)}
          </p>
        </div>
      )}
    </div>
  );
});

// ─── StatusBadge ───

function StatusBadge({ status }: { status: TaskStatus }): React.JSX.Element {
  const config = {
    pending: { label: 'Pending', color: 'text-accent-yellow bg-accent-yellow/10' },
    in_progress: { label: 'In Progress', color: 'text-primary bg-primary/10' },
    completed: { label: 'Completed', color: 'text-accent-green bg-accent-green/10' },
    deleted: { label: 'Deleted', color: 'text-destructive bg-destructive/10' },
  };
  const c = config[status] ?? config.pending;

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${c.color}`}
    >
      {c.label}
    </span>
  );
}

// ─── KanbanLane ───

interface KanbanLaneProps {
  label: string;
  color: string;
  icon: React.ElementType;
  tasks: TaskInfo[];
  count: number;
}

const KanbanLane = memo(function KanbanLane({
  label,
  color,
  icon: Icon,
  tasks,
  count,
}: KanbanLaneProps): React.JSX.Element {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${color}`} />
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <span className="text-xs text-muted-foreground">({count})</span>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.taskId} task={task} />
        ))}
        {tasks.length === 0 && (
          <div className="rounded-md border border-dashed border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">없음</p>
          </div>
        )}
      </div>
    </div>
  );
});

// ─── PlansPanel ───

/** compact: Tasks 탭 (제목+메타만), full: Plans 탭 (마크다운 펼치기) */
const PlanCard = memo(function PlanCard({
  plan,
  compact = false,
}: {
  plan: PlanInfo;
  compact?: boolean;
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);

  // compact 모드: 제목 + 메타 정보만
  if (compact) {
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2.5">
        <p className="text-sm font-semibold text-foreground truncate">{plan.title}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{plan.projectName}</span>
          <span>·</span>
          <span>{plan.sessionId.slice(0, 8)}</span>
          <span>·</span>
          <span>{formatTimeAgo(plan.timestamp)}</span>
        </div>
        {plan.allowedPrompts.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {plan.allowedPrompts.slice(0, 3).map((ap, i) => (
              <span
                key={i}
                className="rounded bg-primary/10 px-1 py-0.5 text-[10px] text-primary"
              >
                {ap.prompt}
              </span>
            ))}
            {plan.allowedPrompts.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{plan.allowedPrompts.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // full 모드: 펼치기/접기 + 마크다운
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div
        className="flex items-start gap-2 cursor-pointer"
        onClick={() => setExpanded((p) => !p)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{plan.title}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{plan.projectName}</span>
            <span>·</span>
            <span>{plan.sessionId.slice(0, 8)}</span>
            <span>·</span>
            <span>{formatTimeAgo(plan.timestamp)}</span>
            {plan.allowedPrompts.length > 0 && (
              <>
                <span>·</span>
                <span className="text-primary">{plan.allowedPrompts.length}개 허용 프롬프트</span>
              </>
            )}
          </div>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 ml-6 space-y-3">
          <div className="prose prose-invert prose-sm max-w-none text-xs">
            <ReactMarkdown>{plan.content}</ReactMarkdown>
          </div>
          {plan.allowedPrompts.length > 0 && (
            <div className="border-t border-border/50 pt-2">
              <p className="text-[10px] font-medium text-muted-foreground mb-1">허용된 프롬프트</p>
              <div className="flex flex-wrap gap-1">
                {plan.allowedPrompts.map((ap, i) => (
                  <span
                    key={i}
                    className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                  >
                    {ap.tool}: {ap.prompt}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

import { FileText as PlanIcon } from 'lucide-react';

function PlansLane({
  plans,
}: {
  plans: PlanInfo[];
}): React.JSX.Element {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-3">
        <PlanIcon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Plan</h3>
        {plans.length > 0 && (
          <span className="text-xs text-primary">(현재)</span>
        )}
      </div>
      <div className="space-y-2">
        {plans.map((plan, i) => (
          <PlanCard key={`${plan.sessionId}-${i}`} plan={plan} compact />
        ))}
        {plans.length === 0 && (
          <div className="rounded-md border border-dashed border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">없음</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TaskBoard ───

// 30초 간격 폴링 — 다른 프로젝트(활성 세션이 아닌)에서 생성되는 태스크/플랜을
// 실시간에 가깝게 반영. session-watcher는 열어본 세션만 감시하므로 폴링이 최소 침습적 해결책.
const POLL_INTERVAL_MS = 30_000;

export function TaskBoard(): React.JSX.Element {
  const { groups, fetchSessions } = useSessionStore();
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [activeView, setActiveView] = useState<'tasks' | 'plans'>('tasks');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const refetch = useCallback(async (showSpinner: boolean): Promise<void> => {
    if (showSpinner) setIsLoading(true);
    try {
      const [tasksResult, plansResult] = await Promise.all([
        window.api?.getAllTasks?.() ?? Promise.resolve(null),
        window.api?.getAllPlans?.() ?? Promise.resolve(null),
      ]);
      if (!isMountedRef.current) return;
      if (!tasksResult) throw new Error('preload API를 사용할 수 없습니다');
      setTasks(tasksResult.tasks);
      if (plansResult) setPlans(plansResult);
      setError(null);
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : '태스크 조회 실패');
      }
    } finally {
      if (showSpinner && isMountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch(true);
    const id = setInterval(() => {
      refetch(false);
    }, POLL_INTERVAL_MS);
    const onFocus = (): void => {
      refetch(false);
    };
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [refetch]);

  // 프로젝트 목록: tasks + sessions 전체 프로젝트 합집합
  const projects = useMemo(() => {
    const fromTasks = tasks.map((t) => t.projectName);
    const fromGroups = groups.map((g) => g.projectName);
    return [...new Set([...fromTasks, ...fromGroups])].sort();
  }, [tasks, groups]);

  // 필터링
  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (selectedProject !== 'all') {
      result = result.filter((t) => t.projectName === selectedProject);
    }
    if (!showDeleted) {
      result = result.filter((t) => t.status !== 'deleted');
    }
    return result;
  }, [tasks, selectedProject, showDeleted]);

  // 레인별 분류
  const lanes = useMemo(
    () =>
      LANE_CONFIG.map((lane) => ({
        ...lane,
        tasks: filteredTasks.filter((t) => t.status === lane.status),
      })),
    [filteredTasks]
  );

  const filteredPlans = useMemo(
    () =>
      selectedProject === 'all'
        ? plans
        : plans.filter((p) => p.projectName === selectedProject),
    [plans, selectedProject]
  );

  // 칸반 보드용: 프로젝트별 최신 플랜 1개씩 (all 필터 시 프로젝트 개수만큼, 특정 프로젝트 필터 시 1개)
  const activePlan = useMemo(() => pickLatestPlanPerProject(filteredPlans), [filteredPlans]);

  const deletedCount = useMemo(() => tasks.filter((t) => t.status === 'deleted').length, [tasks]);

  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter((t) => t.status === 'completed').length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, rate };
  }, [filteredTasks]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-10 w-48 rounded bg-muted animate-pulse" />
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-48 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-destructive">
        <p>태스크를 불러올 수 없습니다: {error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="page-tasks">
      {/* 헤더 */}
      <div className="flex items-center gap-4 border-b border-border px-4 py-3">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />

        {/* Tasks / Plans 탭 */}
        <div className="flex items-center gap-1 rounded-md bg-muted p-0.5">
          <button
            onClick={() => setActiveView('tasks')}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              activeView === 'tasks'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tasks
          </button>
          <button
            onClick={() => setActiveView('plans')}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              activeView === 'plans'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Plans
          </button>
        </div>

        {activeView === 'tasks' && (
          <span className="text-xs text-muted-foreground">
            {stats.total}개 · 완료율 {stats.rate}%
          </span>
        )}
        {activeView === 'plans' && (
          <span className="text-xs text-muted-foreground">
            {filteredPlans.length}개 플랜
          </span>
        )}
        <div className="flex-1" />

        {/* 프로젝트 필터 */}
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
        >
          <option value="all">모든 프로젝트</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {/* deleted 토글 (tasks 뷰에서만) */}
        {activeView === 'tasks' && deletedCount > 0 && (
          <button
            onClick={() => setShowDeleted(!showDeleted)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
              showDeleted
                ? 'bg-destructive/10 text-destructive'
                : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            <Trash2 className="h-3 w-3" />
            삭제됨 ({deletedCount})
          </button>
        )}
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeView === 'tasks' ? (
          <div className="flex gap-4">
            <PlansLane plans={activePlan} />
            {lanes.map((lane) => (
              <KanbanLane
                key={lane.status}
                label={lane.label}
                color={lane.color}
                icon={lane.icon}
                tasks={lane.tasks}
                count={lane.tasks.length}
              />
            ))}
          </div>
        ) : (
          filteredPlans.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>플랜 히스토리가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPlans.map((plan, i) => (
                <PlanCard key={`${plan.sessionId}-${i}`} plan={plan} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
