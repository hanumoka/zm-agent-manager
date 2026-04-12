import type { PlanInfo } from '@shared/types';

/**
 * `PlanInfo.timestamp`가 `string | number` union이라 비교 전 정규화.
 * - number: 그대로
 * - string: `Date.parse` 기반. 파싱 실패 시 `0` (가장 오래된 것으로 취급)
 */
function getPlanTs(p: PlanInfo): number {
  if (typeof p.timestamp === 'number') return p.timestamp;
  const parsed = new Date(p.timestamp).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 플랜 목록에서 프로젝트별 가장 최신 플랜 1개씩 선택.
 * 반환 순서는 timestamp 내림차순 (최신 프로젝트가 앞).
 *
 * **용도**: TaskBoard 칸반 뷰의 Plans 레인이 "모든 프로젝트" 필터일 때
 * 각 프로젝트의 현재 진행 중인(최신) 플랜을 병렬 노출하기 위함.
 * 단일 프로젝트 필터 시에는 자연스럽게 해당 프로젝트 1개만 반환.
 *
 * @param plans 플랜 목록 (정렬 상태 무관)
 */
export function pickLatestPlanPerProject(plans: PlanInfo[]): PlanInfo[] {
  const byProject = new Map<string, PlanInfo>();
  for (const p of plans) {
    const existing = byProject.get(p.projectName);
    if (!existing || getPlanTs(p) > getPlanTs(existing)) {
      byProject.set(p.projectName, p);
    }
  }
  return Array.from(byProject.values()).sort((a, b) => getPlanTs(b) - getPlanTs(a));
}
