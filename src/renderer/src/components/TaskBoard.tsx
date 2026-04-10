import { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
import type { TaskInfo, TaskStatus, TaskSeverity, TaskType, TaskMetadata } from '@shared/types';

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

  // expanded 될 때 메타데이터 로드
  useEffect(() => {
    if (!expanded) return;
    let mounted = true;
    window.api?.getTaskMetadata?.(task.taskId)?.then((m) => {
      if (mounted) setMeta(m);
    });
    return () => {
      mounted = false;
    };
  }, [expanded, task.taskId]);

  const handleMetaChange = useCallback(
    async (field: 'severity' | 'type', value: string) => {
      const next: TaskMetadata = {
        taskId: task.taskId,
        ...meta,
        [field]: value || undefined,
        updatedAt: Date.now(),
      };
      try {
        const saved = await window.api?.setTaskMetadata?.(next);
        if (saved) setMeta(saved);
      } catch {
        // 실패 시 무음 (UI에 영향 없음)
      }
    },
    [task.taskId, meta]
  );

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

// ─── TaskBoard ───

export function TaskBoard(): React.JSX.Element {
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('all');

  useEffect(() => {
    let isMounted = true;
    async function load(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const result = await window.api?.getAllTasks?.();
        if (!result) throw new Error('preload API를 사용할 수 없습니다');
        if (isMounted) setTasks(result.tasks);
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : '태스크 조회 실패');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  // 프로젝트 목록 추출
  const projects = useMemo(() => [...new Set(tasks.map((t) => t.projectName))].sort(), [tasks]);

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
        <h2 className="text-sm font-semibold text-foreground">태스크 보드</h2>
        <span className="text-xs text-muted-foreground">
          {stats.total}개 · 완료율 {stats.rate}%
        </span>
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

        {/* deleted 토글 */}
        {deletedCount > 0 && (
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

      {/* 칸반 보드 */}
      <div className="flex-1 overflow-y-auto p-4">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>태스크가 없습니다. Claude Code에서 태스크를 생성하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="flex gap-4">
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
        )}
      </div>
    </div>
  );
}
