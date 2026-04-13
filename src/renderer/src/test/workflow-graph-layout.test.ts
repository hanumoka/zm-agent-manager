import { describe, it, expect } from 'vitest';
import {
  computeLevels,
  computeGraphLayout,
  edgePath,
} from '../lib/workflow-graph-layout';
import type { WorkflowNode, WorkflowEdge } from '@shared/types';

describe('computeLevels', () => {
  it('linear chain은 level 0, 1, 2', () => {
    const nodes: WorkflowNode[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges: WorkflowEdge[] = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ];
    const levels = computeLevels(nodes, edges, 'a');
    expect(levels.get('a')).toBe(0);
    expect(levels.get('b')).toBe(1);
    expect(levels.get('c')).toBe(2);
  });

  it('loop edge는 level 재할당 없음', () => {
    const nodes: WorkflowNode[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges: WorkflowEdge[] = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'a' }, // loop back
    ];
    const levels = computeLevels(nodes, edges, 'a');
    expect(levels.get('a')).toBe(0);
    expect(levels.get('b')).toBe(1);
    expect(levels.get('c')).toBe(2);
  });

  it('도달 불가 노드는 level 0', () => {
    const nodes: WorkflowNode[] = [{ id: 'a' }, { id: 'b' }, { id: 'orphan' }];
    const edges: WorkflowEdge[] = [{ from: 'a', to: 'b' }];
    const levels = computeLevels(nodes, edges, 'a');
    expect(levels.get('orphan')).toBe(0);
  });
});

describe('computeGraphLayout', () => {
  it('linear chain 레이아웃', () => {
    const nodes: WorkflowNode[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges: WorkflowEdge[] = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ];
    const result = computeGraphLayout(nodes, edges, 'a', { width: 900 });
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);
    expect(result.edges[0].kind).toBe('forward');
    // x좌표는 증가
    expect(result.nodes[0].x).toBeLessThan(result.nodes[1].x);
    expect(result.nodes[1].x).toBeLessThan(result.nodes[2].x);
  });

  it('loop 엣지 감지', () => {
    const nodes: WorkflowNode[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges: WorkflowEdge[] = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'a' },
    ];
    const result = computeGraphLayout(nodes, edges, 'a', { width: 900 });
    const loop = result.edges.find((e) => e.from.id === 'c' && e.to.id === 'a');
    expect(loop?.kind).toBe('loop');
  });

  it('self edge 감지', () => {
    const nodes: WorkflowNode[] = [{ id: 'a' }];
    const edges: WorkflowEdge[] = [{ from: 'a', to: 'a' }];
    const result = computeGraphLayout(nodes, edges, 'a', { width: 500 });
    expect(result.edges[0].kind).toBe('self');
  });

  it('빈 노드 입력 → 빈 결과', () => {
    const result = computeGraphLayout([], [], undefined, { width: 500 });
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('같은 level에 여러 노드 — vertical stacking', () => {
    const nodes: WorkflowNode[] = [
      { id: 'start' },
      { id: 'a' },
      { id: 'b' },
      { id: 'end' },
    ];
    const edges: WorkflowEdge[] = [
      { from: 'start', to: 'a' },
      { from: 'start', to: 'b' },
      { from: 'a', to: 'end' },
      { from: 'b', to: 'end' },
    ];
    const result = computeGraphLayout(nodes, edges, 'start', { width: 900 });
    const aNode = result.nodes.find((n) => n.id === 'a');
    const bNode = result.nodes.find((n) => n.id === 'b');
    expect(aNode?.level).toBe(1);
    expect(bNode?.level).toBe(1);
    expect(aNode?.y).not.toBe(bNode?.y);
  });

  it('taskCountByNode → count 반영', () => {
    const nodes: WorkflowNode[] = [{ id: 'a' }];
    const counts = new Map([['a', 5]]);
    const result = computeGraphLayout(nodes, [], 'a', {
      width: 500,
      taskCountByNode: counts,
    });
    expect(result.nodes[0].count).toBe(5);
  });
});

describe('edgePath', () => {
  const dummyNode = (id: string, x: number, y: number): Parameters<typeof edgePath>[0]['from'] => ({
    id,
    level: 0,
    rowIndex: 0,
    x,
    y,
    r: 30,
    count: 0,
  });

  it('forward edge — bezier', () => {
    const d = edgePath({
      key: 'a->b',
      from: dummyNode('a', 100, 100),
      to: dummyNode('b', 300, 100),
      kind: 'forward',
    });
    expect(d).toMatch(/^M .*C /);
  });

  it('loop edge — quadratic arc', () => {
    const d = edgePath({
      key: 'b->a',
      from: dummyNode('b', 300, 100),
      to: dummyNode('a', 100, 100),
      kind: 'loop',
    });
    expect(d).toMatch(/^M .*Q /);
  });

  it('self edge', () => {
    const d = edgePath({
      key: 'a->a',
      from: dummyNode('a', 100, 100),
      to: dummyNode('a', 100, 100),
      kind: 'self',
    });
    expect(d.startsWith('M')).toBe(true);
  });
});
