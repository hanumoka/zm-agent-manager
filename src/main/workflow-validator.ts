import type {
  WorkflowDefinition,
  WorkflowValidationError,
  WorkflowValidationResult,
} from '@shared/types';

/**
 * 워크플로우 유효성 검증 (INBOX #13).
 *
 * 7가지 룰:
 *  1. name 필수
 *  2. (statechart) start 필수 + nodes에 존재
 *  3. (statechart) end 1개 이상 + 각 end가 nodes에 존재
 *  4. 노드 id 유일성
 *  5. edges의 from/to가 nodes에 존재
 *  6. start에서 모든 노드 도달 가능 (BFS)
 *  7. 모든 노드에서 end 도달 가능 (역방향 BFS; 데드락 방지)
 *     + end 노드는 outgoing edge 없음
 *
 * linear(stages만 있는) 워크플로우는 name/stages 최소 검증만 수행.
 */
export function validateWorkflow(wf: WorkflowDefinition): WorkflowValidationResult {
  const errors: WorkflowValidationError[] = [];

  if (!wf.name || !wf.name.trim()) {
    errors.push({ rule: 'name-required', message: 'name은 필수입니다' });
  }

  const nodes = wf.nodes ?? [];
  const edges = wf.edges ?? [];

  // statechart 스키마가 아니면 linear로 처리
  if (nodes.length === 0) {
    if (!wf.stages || wf.stages.length === 0) {
      errors.push({
        rule: 'stages-or-nodes-required',
        message: 'stages 또는 nodes/edges 중 하나를 정의해야 합니다',
      });
    }
    return { valid: errors.length === 0, errors };
  }

  // rule 4: unique node ids
  const ids = new Set<string>();
  const dupes = new Set<string>();
  for (const n of nodes) {
    if (ids.has(n.id)) dupes.add(n.id);
    ids.add(n.id);
  }
  for (const d of dupes) {
    errors.push({ rule: 'unique-ids', message: `중복된 노드 id: "${d}"` });
  }

  // rule 2: start
  if (!wf.start) {
    errors.push({ rule: 'start-required', message: 'start 노드를 지정해야 합니다' });
  } else if (!ids.has(wf.start)) {
    errors.push({
      rule: 'start-exists',
      message: `start="${wf.start}" 노드가 nodes에 없습니다`,
    });
  }

  // rule 3: end
  const ends = wf.end ?? [];
  if (ends.length === 0) {
    errors.push({
      rule: 'end-required',
      message: 'end 노드를 1개 이상 지정해야 합니다',
    });
  }
  for (const e of ends) {
    if (!ids.has(e)) {
      errors.push({ rule: 'end-exists', message: `end="${e}" 노드가 nodes에 없습니다` });
    }
  }

  // rule 5: edge refs
  for (const e of edges) {
    if (!ids.has(e.from)) {
      errors.push({ rule: 'edge-from', message: `edge.from="${e.from}"가 존재하지 않습니다` });
    }
    if (!ids.has(e.to)) {
      errors.push({ rule: 'edge-to', message: `edge.to="${e.to}"가 존재하지 않습니다` });
    }
  }

  // rule 6: start → 모든 노드 도달
  if (wf.start && ids.has(wf.start)) {
    const reachable = new Set<string>([wf.start]);
    const queue: string[] = [wf.start];
    while (queue.length > 0) {
      const cur = queue.shift() as string;
      for (const e of edges) {
        if (e.from === cur && ids.has(e.to) && !reachable.has(e.to)) {
          reachable.add(e.to);
          queue.push(e.to);
        }
      }
    }
    for (const n of nodes) {
      if (!reachable.has(n.id)) {
        errors.push({
          rule: 'unreachable',
          message: `노드 "${n.id}"는 start에서 도달할 수 없습니다`,
        });
      }
    }
  }

  // rule 7: 역방향 BFS — 모든 노드 → end 도달
  if (ends.length > 0) {
    const canReachEnd = new Set<string>();
    for (const e of ends) if (ids.has(e)) canReachEnd.add(e);
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of edges) {
        if (canReachEnd.has(e.to) && ids.has(e.from) && !canReachEnd.has(e.from)) {
          canReachEnd.add(e.from);
          changed = true;
        }
      }
    }
    for (const n of nodes) {
      if (!canReachEnd.has(n.id)) {
        errors.push({
          rule: 'dead-end',
          message: `노드 "${n.id}"에서 end까지 도달할 수 없습니다 (데드락)`,
        });
      }
    }
  }

  // end 노드는 outgoing edge 금지
  for (const endId of ends) {
    const outgoing = edges.filter((e) => e.from === endId);
    if (outgoing.length > 0) {
      errors.push({
        rule: 'end-no-outgoing',
        message: `end 노드 "${endId}"는 outgoing edge를 가질 수 없습니다`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
