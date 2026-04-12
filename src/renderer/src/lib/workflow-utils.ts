import type { TaskInfo, TaskMetadata } from '@shared/types';

/**
 * 태스크를 워크플로우 단계에 매핑.
 *
 * 우선순위:
 * 1. `metadata.workflowStage` (명시적 할당) — stages 배열에 포함된 값이어야 함
 * 2. `task.status` 기반 폴백:
 *    - `pending` → stages[0]
 *    - `in_progress` → stages[Math.floor((stages.length - 1) / 2)] (중간)
 *    - `completed` → stages[stages.length - 1]
 *    - `deleted` → null (파이프라인에서 제외)
 *
 * @returns 단계 이름 또는 null (매핑 불가)
 */
export function mapTaskToStage(
  task: TaskInfo,
  meta: TaskMetadata | undefined,
  stages: string[]
): string | null {
  if (meta?.workflowStage && stages.includes(meta.workflowStage)) {
    return meta.workflowStage;
  }
  if (stages.length === 0) return null;
  switch (task.status) {
    case 'pending':
      return stages[0];
    case 'in_progress':
      return stages[Math.floor((stages.length - 1) / 2)];
    case 'completed':
      return stages[stages.length - 1];
    case 'deleted':
    default:
      return null;
  }
}

/**
 * 태스크 목록을 단계별로 그룹핑. 반환되는 Map은 항상 모든 stage 키를 포함 (빈 배열 포함).
 * `deleted` 상태 태스크와 매핑 실패 태스크는 제외.
 */
export function groupTasksByStage(
  tasks: TaskInfo[],
  metadataMap: Map<string, TaskMetadata>,
  stages: string[]
): Map<string, TaskInfo[]> {
  const map = new Map<string, TaskInfo[]>();
  for (const s of stages) map.set(s, []);
  for (const t of tasks) {
    if (t.status === 'deleted') continue;
    const stage = mapTaskToStage(t, metadataMap.get(t.taskId), stages);
    if (!stage) continue;
    map.get(stage)?.push(t);
  }
  return map;
}
