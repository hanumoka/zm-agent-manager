import type { WorkflowNode, WorkflowEdge } from '@shared/types';

/**
 * 워크플로우 그래프 레이아웃 계산 (INBOX #13).
 *
 * - BFS로 start부터 각 노드의 level을 계산 (도달 불가 노드는 level 0)
 * - level별로 컬럼 x 배치, 같은 level은 vertical stack
 * - 엣지는 3가지 분류:
 *   - forward: from.level < to.level (정방향 bezier)
 *   - loop: from.level >= to.level (역방향 또는 same-level, arc 위쪽)
 *   - self: from.id === to.id (작은 원)
 */

export interface NodeLayout {
  id: string;
  level: number;
  /** level 내에서 0부터 시작하는 인덱스 */
  rowIndex: number;
  x: number;
  y: number;
  r: number;
  count: number;
}

export interface EdgeLayout {
  key: string;
  from: NodeLayout;
  to: NodeLayout;
  label?: string;
  kind: 'forward' | 'loop' | 'self';
}

export interface GraphLayoutResult {
  nodes: NodeLayout[];
  edges: EdgeLayout[];
  width: number;
  height: number;
}

export interface LayoutOptions {
  width: number;
  paddingX?: number;
  paddingY?: number;
  baseRadius?: number;
  maxRadius?: number;
  levelSpacing?: number;
  rowSpacing?: number;
  /** 노드별 태스크 수 — 반경 크기 산정용 */
  taskCountByNode?: Map<string, number>;
}

/** BFS로 각 노드의 start 기준 level 계산. 도달 불가는 level 0. */
export function computeLevels(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  start: string | undefined
): Map<string, number> {
  const levels = new Map<string, number>();
  if (nodes.length === 0) return levels;
  const byId = new Set(nodes.map((n) => n.id));
  const startId = start && byId.has(start) ? start : nodes[0].id;
  levels.set(startId, 0);
  const queue: string[] = [startId];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    const curLevel = levels.get(cur) ?? 0;
    for (const e of edges) {
      if (e.from === cur && byId.has(e.to) && !levels.has(e.to)) {
        levels.set(e.to, curLevel + 1);
        queue.push(e.to);
      }
    }
  }
  for (const n of nodes) {
    if (!levels.has(n.id)) levels.set(n.id, 0);
  }
  return levels;
}

export function computeGraphLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  start: string | undefined,
  options: LayoutOptions
): GraphLayoutResult {
  const {
    width,
    paddingX = 80,
    paddingY = 60,
    baseRadius = 30,
    maxRadius = 52,
    rowSpacing = 120,
    taskCountByNode = new Map(),
  } = options;

  if (nodes.length === 0) {
    return { nodes: [], edges: [], width, height: 200 };
  }

  const levels = computeLevels(nodes, edges, start);
  const byLevel = new Map<number, WorkflowNode[]>();
  for (const n of nodes) {
    const lv = levels.get(n.id) ?? 0;
    const list = byLevel.get(lv) ?? [];
    list.push(n);
    byLevel.set(lv, list);
  }
  const maxLevel = Math.max(...levels.values(), 0);
  const levelCount = maxLevel + 1;
  const usableWidth = Math.max(width - paddingX * 2, 0);
  const levelSpacing =
    options.levelSpacing ?? (levelCount > 1 ? usableWidth / (levelCount - 1) : 0);

  // 최대 row 수에 기반한 높이
  const maxRows = Math.max(...Array.from(byLevel.values()).map((l) => l.length));
  const height = paddingY * 2 + Math.max((maxRows - 1) * rowSpacing, 0) + maxRadius * 2;
  const centerY = height / 2;

  const layoutNodes: NodeLayout[] = [];
  const byIdLayout = new Map<string, NodeLayout>();

  for (let lv = 0; lv <= maxLevel; lv++) {
    const nodesAtLevel = byLevel.get(lv) ?? [];
    const totalRows = nodesAtLevel.length;
    nodesAtLevel.forEach((node, idx) => {
      const count = taskCountByNode.get(node.id) ?? 0;
      const r = Math.min(baseRadius + Math.min(count, 10) * 2.2, maxRadius);
      const x = levelCount > 1 ? paddingX + lv * levelSpacing : width / 2;
      const yOffset = (idx - (totalRows - 1) / 2) * rowSpacing;
      const y = centerY + yOffset;
      const nl: NodeLayout = { id: node.id, level: lv, rowIndex: idx, x, y, r, count };
      layoutNodes.push(nl);
      byIdLayout.set(node.id, nl);
    });
  }

  const layoutEdges: EdgeLayout[] = [];
  for (const e of edges) {
    const from = byIdLayout.get(e.from);
    const to = byIdLayout.get(e.to);
    if (!from || !to) continue;
    const kind: EdgeLayout['kind'] =
      from.id === to.id ? 'self' : from.level < to.level ? 'forward' : 'loop';
    layoutEdges.push({
      key: `${e.from}->${e.to}`,
      from,
      to,
      label: e.label,
      kind,
    });
  }

  return { nodes: layoutNodes, edges: layoutEdges, width, height };
}

/** 엣지 path (SVG d 속성) 생성 */
export function edgePath(edge: EdgeLayout): string {
  const { from, to, kind } = edge;
  if (kind === 'self') {
    // 노드 위쪽으로 작은 원 루프
    const cx = from.x;
    const cy = from.y - from.r;
    const r = from.r * 0.6;
    return `M ${cx - r * 0.3},${cy} C ${cx - r},${cy - r * 2} ${cx + r},${cy - r * 2} ${cx + r * 0.3},${cy}`;
  }
  if (kind === 'forward') {
    // 오른쪽 베지어 (horizontal tangent)
    const x1 = from.x + from.r;
    const y1 = from.y;
    const x2 = to.x - to.r;
    const y2 = to.y;
    const offset = Math.max((x2 - x1) * 0.4, 24);
    return `M ${x1},${y1} C ${x1 + offset},${y1} ${x2 - offset},${y2} ${x2},${y2}`;
  }
  // loop: 역방향/same-level — 위쪽 arc
  const x1 = from.x;
  const y1 = from.y - from.r;
  const x2 = to.x;
  const y2 = to.y - to.r;
  const midX = (x1 + x2) / 2;
  const dist = Math.abs(x1 - x2);
  const midY = Math.min(y1, y2) - Math.max(dist * 0.35, 60);
  return `M ${x1},${y1} Q ${midX},${midY} ${x2},${y2}`;
}
