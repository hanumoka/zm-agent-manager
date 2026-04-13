import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { formatTimeAgo } from '@/lib/utils';
import { groupTasksByStage } from '@/lib/workflow-utils';
import {
  computeGraphLayout,
  edgePath,
  type NodeLayout,
} from '@/lib/workflow-graph-layout';
import type {
  TaskInfo,
  TaskMetadata,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
} from '@shared/types';

// ─── 레이아웃 상수 ───

const LABEL_OFFSET = 24;
const MIN_HEIGHT = 280;

interface WorkflowGraphProps {
  workflow: WorkflowDefinition;
  tasks: TaskInfo[];
  metadataMap: Map<string, TaskMetadata>;
}

/**
 * 워크플로우 그래프 시각화.
 *
 * - Statechart 스키마(nodes/edges 존재) → BFS 레벨 레이아웃 + loop arc
 * - Linear 레거시 스키마 → stages 배열을 자동 linear chain으로 변환하여 렌더
 */
export const WorkflowGraph = memo(function WorkflowGraph({
  workflow,
  tasks,
  metadataMap,
}: WorkflowGraphProps): React.JSX.Element {
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

  // 단계별 태스크 그룹 — mapTaskToStage는 stages[]를 사용하므로 statechart여도 호환
  const byStage = useMemo(
    () => groupTasksByStage(tasks, metadataMap, workflow.stages),
    [tasks, metadataMap, workflow.stages]
  );

  // Statechart면 workflow.nodes/edges 사용, 아니면 stages로 linear chain 생성
  const { nodes, edges, startId } = useMemo(() => {
    if (workflow.nodes && workflow.nodes.length > 0) {
      return {
        nodes: workflow.nodes,
        edges: workflow.edges ?? [],
        startId: workflow.start ?? workflow.nodes[0].id,
      };
    }
    // linear fallback
    const linearNodes: WorkflowNode[] = workflow.stages.map((s) => ({ id: s }));
    const linearEdges: WorkflowEdge[] = [];
    for (let i = 0; i < workflow.stages.length - 1; i++) {
      linearEdges.push({ from: workflow.stages[i], to: workflow.stages[i + 1] });
    }
    return {
      nodes: linearNodes,
      edges: linearEdges,
      startId: workflow.stages[0],
    };
  }, [workflow.nodes, workflow.edges, workflow.stages, workflow.start]);

  const taskCountByNode = useMemo(() => {
    const m = new Map<string, number>();
    for (const [stage, list] of byStage.entries()) m.set(stage, list.length);
    return m;
  }, [byStage]);

  const layout = useMemo(
    () =>
      computeGraphLayout(nodes, edges, startId, {
        width: containerWidth,
        taskCountByNode,
      }),
    [nodes, edges, startId, containerWidth, taskCountByNode]
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

  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const selectedTasks =
    selectedStage !== null ? (byStage.get(selectedStage) ?? []) : [];

  const svgHeight = Math.max(layout.height, MIN_HEIGHT);

  const renderNode = (node: NodeLayout): React.JSX.Element => {
    const hasTasks = node.count > 0;
    const isActive = activeNodes.has(node.id);
    const isSelected = selectedStage === node.id;
    return (
      <g
        key={node.id}
        className={`cursor-pointer ${isActive ? 'wfg-node-active' : ''}`}
        onClick={() => setSelectedStage(isSelected ? null : node.id)}
        data-testid={`workflow-node-${node.id}`}
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
          {node.id}
        </text>
      </g>
    );
  };

  return (
    <div className="flex flex-col h-full" data-testid="workflow-graph">
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

      <div ref={containerRef} className="w-full shrink-0">
        <svg
          width="100%"
          height={svgHeight}
          viewBox={`0 0 ${containerWidth} ${svgHeight}`}
          preserveAspectRatio="xMidYMid meet"
          data-testid="workflow-graph-svg"
        >
          {/* 엣지 */}
          {layout.edges.map((edge) => {
            const isActive = activeEdges.has(edge.key);
            const isLoop = edge.kind === 'loop' || edge.kind === 'self';
            return (
              <g key={edge.key}>
                <path
                  d={edgePath(edge)}
                  fill="none"
                  stroke={
                    isActive
                      ? 'hsl(var(--accent-green))'
                      : isLoop
                        ? 'hsl(var(--destructive) / 0.6)'
                        : 'hsl(var(--accent-green) / 0.35)'
                  }
                  strokeWidth={isActive ? 3 : 2}
                  strokeDasharray="6 6"
                  className={isActive ? 'wfg-edge-active' : 'wfg-edge'}
                />
                {edge.label && (
                  <text
                    x={(edge.from.x + edge.to.x) / 2}
                    y={
                      edge.kind === 'loop'
                        ? Math.min(edge.from.y, edge.to.y) - 50
                        : (edge.from.y + edge.to.y) / 2 - 6
                    }
                    textAnchor="middle"
                    className="text-[10px] fill-muted-foreground"
                    style={{ pointerEvents: 'none' }}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* 노드 */}
          {layout.nodes.map(renderNode)}
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
