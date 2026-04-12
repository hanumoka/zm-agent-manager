import { useCallback, useEffect, useRef, useState } from 'react';
import { GitBranch } from 'lucide-react';
import { LiveStatus } from '@/components/LiveStatus';
import { WorkflowGraph } from '@/components/WorkflowGraph';
import type {
  KnownProject,
  ProjectWorkflowResult,
  TaskInfo,
  TaskMetadata,
} from '@shared/types';

/**
 * 워크플로우 실시간 모니터링 페이지.
 *
 * - **프로젝트 드롭다운 필수** — "모든 프로젝트" 선택지 없음 (프로젝트별 워크플로우 모니터링)
 * - 5초 간격 폴링 + window focus 이벤트
 * - 선택된 프로젝트의 `.claude/workflow.md`를 SVG 그래프로 시각화
 * - 태스크가 파이프라인을 "물처럼 흐르는" 효과 (marching ants 애니메이션)
 */

const POLL_INTERVAL_MS = 5_000;

export function WorkflowPage(): React.JSX.Element {
  const [knownProjects, setKnownProjects] = useState<KnownProject[]>([]);
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null);
  const [projectWorkflow, setProjectWorkflow] = useState<ProjectWorkflowResult | null>(null);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [metadataMap, setMetadataMap] = useState<Map<string, TaskMetadata>>(new Map());
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 초기 1회: 프로젝트 목록 + 기본 선택 결정 (가장 최근 활동 프로젝트)
  useEffect(() => {
    let cancelled = false;
    async function bootstrap(): Promise<void> {
      try {
        const projects = (await window.api?.getKnownProjects?.()) ?? [];
        if (cancelled || !isMountedRef.current) return;
        setKnownProjects(projects);
        if (projects.length > 0) {
          // 기본 선택: 가장 최근 활동 (KnownProject는 lastActivity desc로 정렬됨)
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

  // refetch: 선택된 프로젝트 기준으로 workflow/tasks/metadata 재조회
  const refetch = useCallback(
    async (projectPath: string): Promise<void> => {
      try {
        const [tasksResult, pwResult, metaResult] = await Promise.all([
          window.api?.getAllTasks?.() ?? Promise.resolve(null),
          window.api?.getProjectWorkflow?.(projectPath) ?? Promise.resolve(null),
          window.api?.getAllTaskMetadata?.() ?? Promise.resolve([]),
        ]);
        if (!isMountedRef.current) return;
        if (!tasksResult) throw new Error('preload API를 사용할 수 없습니다');
        setTasks(tasksResult.tasks);
        if (pwResult) setProjectWorkflow(pwResult);
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

  // selectedProjectPath 변경 시 즉시 refetch + 5초 폴링 시작
  useEffect(() => {
    if (!selectedProjectPath) return;
    // 프로젝트 변경 시 이전 workflow 초기화 (flash 방지)
    setProjectWorkflow(null);
    refetch(selectedProjectPath);
    const id = setInterval(() => {
      refetch(selectedProjectPath);
    }, POLL_INTERVAL_MS);
    const onFocus = (): void => {
      refetch(selectedProjectPath);
    };
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [selectedProjectPath, refetch]);

  const workflow = projectWorkflow?.workflow ?? null;
  const projectName = projectWorkflow?.projectName ?? null;

  // 프로젝트 내 태스크만 + deleted 제외
  const scopedTasks = projectName
    ? tasks.filter((t) => t.projectName === projectName && t.status !== 'deleted')
    : [];

  return (
    <div className="flex h-full flex-col" data-testid="page-workflow">
      {/* 헤더 */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <GitBranch className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-semibold text-foreground">Workflow</h1>
        {workflow && (
          <>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-foreground">{workflow.displayName}</span>
            <span className="text-xs text-muted-foreground font-mono">{workflow.name}</span>
            <span className="text-xs text-muted-foreground">· 총 {scopedTasks.length}개</span>
          </>
        )}
        <div className="flex-1" />

        {/* 프로젝트 드롭다운 — "모든 프로젝트" 옵션 없음 */}
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
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center max-w-md px-6">
              <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">알려진 프로젝트가 없습니다</p>
              <p className="text-xs mt-2 text-muted-foreground">
                Claude Code를 사용하여 세션을 생성하면 여기에 프로젝트가 나타납니다.
              </p>
            </div>
          </div>
        ) : !workflow ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center max-w-md px-6">
              <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">이 프로젝트에 워크플로우가 정의되지 않았습니다</p>
              <p className="text-xs mt-2 text-muted-foreground break-all">
                {selectedProjectPath}
              </p>
              <p className="text-xs mt-2 text-muted-foreground">
                해당 프로젝트 루트에 <code>.claude/workflow.md</code>를 생성하세요.
              </p>
              <p className="text-xs mt-1 text-muted-foreground">
                형식 안내: <code>.claude/rules/workflow-system.md</code>
              </p>
            </div>
          </div>
        ) : (
          <WorkflowGraph
            workflow={workflow}
            tasks={scopedTasks}
            metadataMap={metadataMap}
          />
        )}
      </div>
    </div>
  );
}
