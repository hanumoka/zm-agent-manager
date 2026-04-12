import type { DailyCost } from '@shared/types';

export type PeriodKind = 'week' | 'month';

export interface PeriodComparison {
  /** 최근 N일 합산 비용 */
  currentCost: number;
  /** 그 이전 N일 합산 비용 */
  previousCost: number;
  /** 최근 N일 요청 횟수 */
  currentRequests: number;
  /** 그 이전 N일 요청 횟수 */
  previousRequests: number;
  /**
   * 비용 증감률 (%).
   * - previousCost === 0 && currentCost > 0 → `Infinity` (UI에서 "신규" 라벨)
   * - previousCost === 0 && currentCost === 0 → `0`
   */
  costChangePercent: number;
  /**
   * 데이터 가용성.
   * - `ok`: 두 기간 모두 데이터 있음
   * - `insufficient`: byDay 길이가 periodDays * 2 미만 (이전 기간이 불완전)
   * - `empty`: byDay 비어있음
   */
  status: 'ok' | 'insufficient' | 'empty';
}

const PERIOD_DAYS: Record<PeriodKind, number> = {
  week: 7,
  month: 30,
};

/**
 * byDay 배열에서 두 기간의 합산 비용/요청수를 비교.
 *
 * **전제**: `byDay`는 `YYYY-MM-DD` 오름차순 정렬, 날짜 연속성은 보장되지 않음
 * (활동 없는 날은 누락 가능). 따라서 "최근 N일"을 단순히 배열 끝에서 N개로 잘라
 * 시간 기준이 아닌 "활동한 날" 기준으로 비교한다. 이는 스파스 데이터에 강건.
 */
export function computePeriodComparison(
  byDay: DailyCost[],
  kind: PeriodKind
): PeriodComparison {
  const n = PERIOD_DAYS[kind];

  if (byDay.length === 0) {
    return {
      currentCost: 0,
      previousCost: 0,
      currentRequests: 0,
      previousRequests: 0,
      costChangePercent: 0,
      status: 'empty',
    };
  }

  const current = byDay.slice(-n);
  const previous = byDay.slice(-(n * 2), -n);

  const sum = (arr: DailyCost[]): { cost: number; requests: number } => ({
    cost: arr.reduce((acc, d) => acc + d.cost, 0),
    requests: arr.reduce((acc, d) => acc + d.requestCount, 0),
  });

  const cur = sum(current);
  const prev = sum(previous);

  let costChangePercent: number;
  if (prev.cost === 0) {
    costChangePercent = cur.cost > 0 ? Infinity : 0;
  } else {
    costChangePercent = ((cur.cost - prev.cost) / prev.cost) * 100;
  }

  const status: PeriodComparison['status'] = previous.length < n ? 'insufficient' : 'ok';

  return {
    currentCost: cur.cost,
    previousCost: prev.cost,
    currentRequests: cur.requests,
    previousRequests: prev.requests,
    costChangePercent,
    status,
  };
}
