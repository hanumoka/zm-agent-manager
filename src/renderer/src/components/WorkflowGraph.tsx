import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { formatTimeAgo } from '@/lib/utils';
import { groupTasksByStage } from '@/lib/workflow-utils';
import type { TaskInfo, TaskMetadata, WorkflowDefinition } from '@shared/types';

// ─── 레이아웃 상수 ───

const SVG_HEIGHT = 280;
const NODE_Y = 130;
const PADDING_X = 80;
const BASE_RADIUS = 36;
const MAX_RADIUS = 60;
const LABEL_OFFSET = 24;

// ─── 레이아웃 계산 ───

interface NodeLayout {
  stage: string;
  x: number;
  y: number;
  r: number;
  count: number;
  tasks: TaskInfo[];
}

function computeLayout(
  stages: string[],
  byStage: Map<string, TaskInfo[]>,
  width: number
): NodeLayout[] {
  if (stages.length === 0) return [];
  const usableWidth = Math.max(width - PADDING_X * 2, 0);
  const spacing = stages.length > 1 ? usableWidth / (stages.length - 1) : 0;
  return stages.map((stage, i) => {
    const tasks = byStage.get(stage) ?? [];
    const count = tasks.length;
    const r = Math.min(BASE_RADIUS + Math.min(count, 10) * 2.4, MAX_RADIUS);
    const x = stages.length > 1 ? PADDING_X + i * spacing : width / 2;
    return { stage, x, y: NODE_Y, r, count, tasks };
  });
}

// ─── Bezier 엣지 path ───

function bezierPath(from: NodeLayout, to: NodeLayout): string {
  const x1 = from.x + from.r;
  const x2 = to.x - to.r;
  const y = NODE_Y;
  const offset = Math.max((x2 - x1) * 0.4, 20);
  return `M ${x1},${y} C ${x1 + offset},${y} ${x2 - offset},${y} ${x2},${y}`;
}

// ─── WorkflowGraph ───

interface WorkflowGraphProps {
  workflow: WorkflowDefinition;
  tasks: TaskInfo[];
  metadataMap: Map<string, TaskMetadata>;
}

export const WorkflowGraph = memo(function WorkflowGraph({
  workflow,
  tasks,
  metadataMap,
}: WorkflowGraphProps): React.JSX.Element {
  // 컨테이너 width 추적 (responsive SVG)
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(960);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = (): void => setContainerWidth(el.clientWidth || 960);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const byStage = useMemo(
    () => groupTasksByStage(tasks, metadataMap, workflow.stages),
    [tasks, metadataMap, workflow.stages]
  );

  const layout = useMemo(
    () => computeLayout(workflow.stages, byStage, containerWidth),
    [workflow.stages, byStage, containerWidth]
  );

  // 단계 변경 감지 — 활성 엣지 하이라이트 + 노드 glow
  const prevStageRef = useRef<Map<string, string>>(new Map());
  const [activeEdges, setActiveEdges] = useState<Set<string>>(new Set());
  const [activeNodes, setActiveNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const currentStage = new Map<string, string>();
    for (const [stage, list] of byStage.entries()) {
      for (const t of list) currentStage.set(t.taskId, stage);
    }
    const newEdges = new Set<string>();
    const newNodes = new Set<string>();
    for (const [id, stage] of currentStage.entries()) {
      const prev = prevStageRef.current.get(id);
      if (prev !== undefined && prev !== stage) {
        newEdges.add(`${prev}->${stage}`);
        newNodes.add(stage);
      }
    }
    prevStageRef.current = currentStage;
    if (newEdges.size > 0 || newNodes.size > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveEdges(newEdges);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveNodes(newNodes);
      const timer = setTimeout(() => {
        setActiveEdges(new Set());
        setActiveNodes(new Set());
      }, 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [byStage]);

  // 선택된 단계 (태스크 상세 패널)
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const selectedTasks =
    selectedStage !== null ? (byStage.get(selectedStage) ?? []) : [];

  return (
    <div className="flex flex-col h-full" data-testid="workflow-graph">
      {/* CSS 애니메이션 정의 */}
      <style>{`
        @keyframes wfg-flow {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -24; }
        }
        .wfg-edge {
          animation: wfg-flow 2.4s linear infinite;
        }
        .wfg-edge-active {
          animation: wfg-flow 0.5s linear infinite;
        }
        .wfg-node-active circle {
          filter: drop-shadow(0 0 8px hsl(var(--accent-green)));
        }
      `}</style>

      {/* SVG 그래프 */}
      <div ref={containerRef} className="w-full shrink-0">
        <svg
          width="100%"
          height={SVG_HEIGHT}
          viewBox={`0 0 ${containerWidth} ${SVG_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          data-testid="workflow-graph-svg"
        >
          {/* 엣지 */}
          {layout.map((node, i) => {
            if (i === layout.length - 1) return null;
            const next = layout[i + 1];
            const key = `${node.stage}->${next.stage}`;
            const isActive = activeEdges.has(key);
            return (
              <path
                key={key}
                d={bezierPath(node, next)}
                fill="none"
                stroke={
                  isActive
                    ? 'hsl(var(--accent-green))'
                    : 'hsl(var(--accent-green) / 0.35)'
                }
                strokeWidth={isActive ? 3 : 2}
                strokeDasharray="6 6"
                className={isActive ? 'wfg-edge-active' : 'wfg-edge'}
              />
            );
          })}

          {/* 노드 */}
          {layout.map((node) => {
            const hasTasks = node.count > 0;
            const isActive = activeNodes.has(node.stage);
            const isSelected = selectedStage === node.stage;
            return (
              <g
                key={node.stage}
                className={`cursor-pointer ${isActive ? 'wfg-node-active' : ''}`}
                onClick={() => setSelectedStage(isSelected ? null : node.stage)}
                data-testid={`workflow-node-${node.stage}`}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r}
                  fill={
                    hasTasks
                      ? 'hsl(var(--accent-green) / 0.12)'
                      : 'hsl(var(--muted) / 0.3)'
                  }
                  stroke={
                    isSelected
                      ? 'hsl(var(--primary))'
                      : hasTasks
                        ? 'hsl(var(--accent-green))'
                        : 'hsl(var(--border))'
                  }
                  strokeWidth={isSelected ? 3 : 2}
                />
                <text
                  x={node.x}
                  y={node.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={`text-2xl font-semibold ${
                    hasTasks ? 'fill-foreground' : 'fill-muted-foreground'
                  }`}
                  style={{ pointerEvents: 'none' }}
                >
                  {node.count}
                </text>
                <text
                  x={node.x}
                  y={node.y + node.r + LABEL_OFFSET}
                  textAnchor="middle"
                  className="text-xs fill-muted-foreground"
                  style={{ pointerEvents: 'none' }}
                >
                  {node.stage}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 태스크 상세 패널 */}
      <div className="flex-1 overflow-y-auto border-t border-border mt-2 pt-3 px-4">
        {selectedStage === null ? (
          <p className="text-xs text-muted-foreground text-center">
            노드를 클릭하면 해당 단계의 태스크 목록이 표시됩니다
          </p>
        ) : (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">
              {selectedStage}
              <span className="ml-2 text-xs text-muted-foreground">
                ({selectedTasks.length}개)
              </span>
            </h3>
            {selectedTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">이 단계에 태스크가 없습니다</p>
            ) : (
              <ul className="space-y-1.5" data-testid="workflow-stage-task-list">
                {selectedTasks.map((t) => (
                  <li
                    key={t.taskId}
                    className="rounded border border-border bg-card px-3 py-2"
                  >
                    <p className="text-xs font-medium text-foreground truncate">
                      {t.subject}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {t.projectName}
                      </span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTimeAgo(t.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
