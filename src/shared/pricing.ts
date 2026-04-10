/**
 * Claude 모델별 가격 테이블 (USD per 1M tokens).
 * 단일 소스로 정의하여 cost-scanner / stats-service / compute-metrics 등에서 공유한다.
 *
 * @note 새 모델 추가 또는 가격 변경 시 이 파일만 수정하면 모든 곳에 반영된다.
 */

export interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-6': { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  'claude-opus-4-20250514': { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-sonnet-4-20250514': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
};

/** 알 수 없는 모델의 기본 가격 (Sonnet 수준) */
export const DEFAULT_PRICING: ModelPricing = {
  input: 3,
  output: 15,
  cacheRead: 0.3,
  cacheWrite: 3.75,
};

/** 모델명에 해당하는 가격을 반환. 미등록 모델은 DEFAULT_PRICING 사용. */
export function getPricing(model: string): ModelPricing {
  return MODEL_PRICING[model] ?? DEFAULT_PRICING;
}

/**
 * 토큰 수 + 모델명으로 비용(USD) 계산.
 * 모든 스캐너/렌더러에서 일관된 비용 계산을 보장한다.
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens: number
): number {
  const p = getPricing(model);
  return (
    (inputTokens / 1_000_000) * p.input +
    (outputTokens / 1_000_000) * p.output +
    (cacheReadTokens / 1_000_000) * p.cacheRead +
    (cacheWriteTokens / 1_000_000) * p.cacheWrite
  );
}
