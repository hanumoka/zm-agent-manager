import type { ParsedSession, AssistantRecord } from '@shared/types';
import { MODEL_PRICING, DEFAULT_PRICING } from '@shared/pricing';

/**
 * 단일 ParsedSession의 메시지/도구/토큰/비용을 집계한다.
 * ComparePage와 같은 렌더러 컴포넌트에서 사용.
 * main 프로세스의 cost-scanner/stats-service와 일관된 결과를 보장하기 위해
 * 동일한 가격 테이블 / 동일한 순회 로직을 유지한다.
 */
export interface SessionMetrics {
  messageCount: number;
  toolCallCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  cost: number;
  /** 도구 이름별 사용 횟수 */
  toolDistribution: Map<string, number>;
}

export function computeSessionMetrics(session: ParsedSession): SessionMetrics {
  const metrics: SessionMetrics = {
    messageCount: session.messageCount,
    toolCallCount: session.toolCallCount,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    cost: 0,
    toolDistribution: new Map(),
  };

  for (const record of session.records) {
    if (record.type !== 'assistant') continue;
    const assistant = record as AssistantRecord;
    const message = assistant.message;

    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'tool_use') {
          const name = block.name;
          metrics.toolDistribution.set(name, (metrics.toolDistribution.get(name) ?? 0) + 1);
        }
      }
    }

    if (message.usage && message.model) {
      const u = message.usage;
      const input = u.input_tokens ?? 0;
      const output = u.output_tokens ?? 0;
      const cacheRead = u.cache_read_input_tokens ?? 0;
      const cacheWrite = u.cache_creation_input_tokens ?? 0;
      metrics.inputTokens += input;
      metrics.outputTokens += output;
      metrics.cacheReadTokens += cacheRead;
      metrics.cacheWriteTokens += cacheWrite;
      const pricing = MODEL_PRICING[message.model] ?? DEFAULT_PRICING;
      metrics.cost +=
        (input / 1_000_000) * pricing.input +
        (output / 1_000_000) * pricing.output +
        (cacheRead / 1_000_000) * pricing.cacheRead +
        (cacheWrite / 1_000_000) * pricing.cacheWrite;
    }
  }

  metrics.totalTokens =
    metrics.inputTokens + metrics.outputTokens + metrics.cacheReadTokens + metrics.cacheWriteTokens;
  return metrics;
}

/**
 * 정수 카운트 차이 포맷터 (메시지/도구/토큰 등).
 * NaN/Infinity 는 '—'로 안전하게 표시.
 */
export function formatDiffValue(diff: number): string {
  if (!Number.isFinite(diff)) return '—';
  const abs = Math.abs(diff);
  if (abs >= 1_000_000) return `${(diff / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(diff / 1_000).toFixed(1)}K`;
  return String(Math.round(diff));
}

/**
 * 비용 차이 포맷터 — 항상 `$N.NN` 또는 `-$N.NN`.
 * NaN/Infinity 는 '—' 반환.
 */
export function formatCostDiff(diff: number): string {
  if (!Number.isFinite(diff)) return '—';
  if (diff >= 0) return `$${diff.toFixed(2)}`;
  return `-$${Math.abs(diff).toFixed(2)}`;
}
