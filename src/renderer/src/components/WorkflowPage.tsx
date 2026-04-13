import { useCallback, useEffect, useRef, useState } from 'react';
import { GitBranch, Settings } from 'lucide-react';
import { LiveStatus } from '@/components/LiveStatus';
import { WorkflowGraph } from '@/components/WorkflowGraph';
import { WorkflowManager } from '@/components/WorkflowManager';
import type {
  KnownProject,
  ProjectWorkflowListResult,
  TaskInfo,
  TaskMetadata,
  WorkflowDefinition,
} from '@shared/types';

/**
 * 워크플로우 실시간 모니터링 페이지 (INBOX #13 확장).
 *
 * - 프로젝트 드롭다운 + 워크플로우 드롭다운 (프로젝트당 다중 워크플로우)
 * - 5초 간격 폴링
 * - "Manage" 버튼으로 CRUD 에디터 모달 전환
 */

const POLL_INTERVAL_MS = 5_000;

export function WorkflowPage(): React.JSX.Element {
  const [knownProjects, setKnownProjects] = useState<KnownProject[]>([]);
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null);
  const [workflowList, setWorkflowList] = useState<ProjectWorkflowListResult | null>(null);
  const [selectedWorkflowName, setSelectedWorkflowName] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [metadataMap, setMetadataMap] = useState<Map<string, TaskMetadata>>(new Map());
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isManaging, setIsManaging] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 초기 1회: 프로젝트 목록
  useEffect(() => {
    let cancelled = false;
    async function bootstrap(): Promise<void> {
      try {
        const projects = (await window.api?.getKnownProjects?.()) ?? [];
        if (cancelled || !isMountedRef.current) return;
        setKnownProjects(projects);
        if (projects.length > 0) {
          setSelectedProjectPath(projects[0].path);
        } else {
          setIsInitialLoading(false);
        }
      } catch (e) {
        if (!cancelled && isMountedRef.current) {
          setError(e instanceof Error ? e.message : '프로젝트 목록 조회 실패');
          setIsInitialLoading(false);
        }
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const refetch = useCallback(
    async (projectPath: string): Promise<void> => {
      try {
        const [tasksResult, listResult, metaResult] = await Promise.all([
          window.api?.getAllTasks?.() ?? Promise.resolve(null),
          window.api?.listProjectWorkflows?.(projectPath) ?? Promise.resolve(null),
          window.api?.getAllTaskMetadata?.() ?? Promise.resolve([]),
        ]);
        if (!isMountedRef.current) return;
        if (!tasksResult) throw new Error('preload API를 사용할 수 없습니다');
        setTasks(tasksResult.tasks);
        if (listResult) {
          setWorkflowList(listResult);
          setSelectedWorkflowName((prev) => {
            if (prev && listResult.workflows.some((w) => w.name === prev)) return prev;
            const def = listResult.workflows.find((w) => w.name === 'default');
            return def?.name ?? listResult.workflows[0]?.name ?? null;
          });
        }
        if (metaResult) {
          const map = new Map<string, TaskMetadata>();
          for (const m of metaResult) map.set(m.taskId, m);
          setMetadataMap(map);
        }
        setError(null);
        setLastUpdatedAt(Date.now());
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : '워크플로우 데이터 조회 실패');
        }
      } finally {
        if (isMountedRef.current) setIsInitialLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedProjectPath) return;
    setWorkflowList(null);
    setSelectedWorkflowName(null);
    refetch(selectedProjectPath);
    const id = setInterval(() => {
      if (!isManaging) refetch(selectedProjectPath);
    }, POLL_INTERVAL_MS);
    const onFocus = (): void => {
      refetch(selectedProjectPath);
    };
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [selectedProjectPath, refetch, isManaging]);

  const workflows = workflowList?.workflows ?? [];
  const selectedWorkflow: WorkflowDefinition | null =
    workflows.find((w) => w.name === selectedWorkflowName) ?? null;
  const projectName = workflowList?.projectName ?? null;

  const scopedTasks = projectName
    ? tasks.filter((t) => t.projectName === projectName && t.status !== 'deleted')
    : [];

  const handleManagerClose = async (changed: boolean): Promise<void> => {
    setIsManaging(false);
    if (changed && selectedProjectPath) {
      await refetch(selectedProjectPath);
    }
  };

  return (
    <div className="flex h-full flex-col" data-testid="page-workflow">
      {/* 헤더 */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 flex-wrap">
        <GitBranch className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-semibold text-foreground">Workflow</h1>
        {selectedWorkflow && (
          <>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-foreground">{selectedWorkflow.displayName}</span>
            <span className="text-xs text-muted-foreground font-mono">
              {selectedWorkflow.name}
            </span>
            <span className="text-xs text-muted-foreground">· 총 {scopedTasks.length}개</span>
          </>
        )}
        <div className="flex-1" />

        {/* 워크플로우 드롭다운 */}
        {workflows.length > 0 && (
          <select
            value={selectedWorkflowName ?? ''}
            onChange={(e) => setSelectedWorkflowName(e.target.value || null)}
            data-testid="workflow-name-select"
            className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground outline-none max-w-[200px]"
          >
            {workflows.map((w) => (
              <option key={w.name} value={w.name}>
                {w.displayName} ({w.name})
              </option>
            ))}
          </select>
        )}

        {/* 프로젝트 드롭다운 */}
        <select
          value={selectedProjectPath ?? ''}
          onChange={(e) => setSelectedProjectPath(e.target.value || null)}
          data-testid="workflow-project-select"
          className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground outline-none max-w-[360px]"
        >
          {knownProjects.length === 0 ? (
            <option value="">— 프로젝트 없음 —</option>
          ) : (
            knownProjects.map((p) => (
              <option key={p.path} value={p.path}>
                {p.path}
              </option>
            ))
          )}
        </select>

        {selectedProjectPath && (
          <button
            type="button"
            onClick={() => setIsManaging(true)}
            data-testid="workflow-manage-button"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground hover:bg-muted"
          >
            <Settings className="h-3 w-3" />
            Manage
          </button>
        )}

        <LiveStatus lastUpdatedAt={lastUpdatedAt} intervalMs={POLL_INTERVAL_MS} />
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isInitialLoading ? (
          <div className="p-6 space-y-3">
            <div className="h-10 w-64 rounded bg-muted animate-pulse" />
            <div className="h-72 rounded bg-muted animate-pulse" />
          </div>
        ) : error ? (
          <div className="p-6 text-destructive">
            <p>워크플로우 데이터를 불러올 수 없습니다: {error}</p>
          </div>
        ) : knownProjects.length === 0 ? (
          <EmptyState
            title="알려진 프로젝트가 없습니다"
            body="Claude Code를 사용하여 세션을 생성하면 여기에 프로젝트가 나타납니다."
          />
        ) : !selectedWorkflow ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center max-w-md px-6">
              <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">이 프로젝트에 워크플로우가 없습니다</p>
              <p className="text-xs mt-2 text-muted-foreground break-all">
                {selectedProjectPath}
              </p>
              <p className="text-xs mt-2 text-muted-foreground">
                위 <strong>Manage</strong> 버튼으로 워크플로우를 생성하세요.
              </p>
              <p className="text-xs mt-1 text-muted-foreground">
                파일 위치: <code>.claude/zm-agent-manager/workflows/</code>
              </p>
            </div>
          </div>
        ) : (
          <WorkflowGraph
            workflow={selectedWorkflow}
            tasks={scopedTasks}
            metadataMap={metadataMap}
          />
        )}
      </div>

      {/* Manage 모달 */}
      {isManaging && selectedProjectPath && (
        <WorkflowManager
          projectPath={selectedProjectPath}
          workflows={workflows}
          onClose={handleManagerClose}
        />
      )}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      <div className="text-center max-w-md px-6">
        <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs mt-2 text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
