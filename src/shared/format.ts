/**
 * 렌더러 + 메인 공용 포맷 유틸.
 * 순수 함수만 포함 (Node.js/Electron API 무의존).
 */

/**
 * 비용(USD)을 문맥에 맞는 자리수로 포맷.
 *
 * - `>= 1`   → `$1.23`  (소수 2자리)
 * - `>= 0.01`→ `$0.123` (소수 3자리)
 * - 그 외    → `$0.0012` (소수 4자리)
 *
 * 음수/부호 차이가 필요한 경우 `compute-metrics.ts`의 `formatCostDiff`를 사용할 것.
 * (이 함수는 누적 비용처럼 항상 비음수 값을 전제로 함)
 */
export function formatCost(cost: number): string {
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  if (cost >= 0.01) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(4)}`;
}

/**
 * Claude 모델명을 사람이 읽기 쉬운 약식으로 변환.
 * 매칭되지 않으면 원본을 그대로 반환.
 */
export function shortModelName(model: string): string {
  if (model.includes('opus')) return 'Opus';
  if (model.includes('sonnet')) return 'Sonnet';
  if (model.includes('haiku')) return 'Haiku';
  return model;
}
