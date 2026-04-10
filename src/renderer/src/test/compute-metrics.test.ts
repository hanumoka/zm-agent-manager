import { describe, it, expect } from 'vitest';
import { computeSessionMetrics, formatDiffValue, formatCostDiff } from '@/lib/compute-metrics';
import type { ParsedSession, AssistantRecord, UserRecord, JsonlRecord } from '@shared/types';

function userRec(uuid: string): UserRecord {
  return {
    type: 'user',
    uuid,
    parentUuid: null,
    sessionId: 's1',
    timestamp: '2026-04-10T10:00:00Z',
    isSidechain: false,
    userType: 'external',
    entrypoint: 'cli',
    cwd: '/',
    version: '2.0',
    gitBranch: 'main',
    message: { role: 'user', content: 'hello' },
  };
}

function assistantRec(opts: {
  uuid: string;
  model?: string;
  tools?: string[];
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
}): AssistantRecord {
  const content: unknown[] = [{ type: 'text', text: 'ok' }];
  for (const toolName of opts.tools ?? []) {
    content.push({ type: 'tool_use', id: `t-${opts.uuid}`, name: toolName, input: {} });
  }
  const hasUsage =
    opts.input !== undefined ||
    opts.output !== undefined ||
    opts.cacheRead !== undefined ||
    opts.cacheWrite !== undefined;
  return {
    type: 'assistant',
    uuid: opts.uuid,
    parentUuid: null,
    sessionId: 's1',
    timestamp: '2026-04-10T10:00:01Z',
    isSidechain: false,
    userType: 'external',
    entrypoint: 'cli',
    cwd: '/',
    version: '2.0',
    gitBranch: 'main',
    message: {
      role: 'assistant',
      model: opts.model ?? 'claude-opus-4-6',
      content: content as never[],
      usage: hasUsage
        ? {
            input_tokens: opts.input ?? 0,
            output_tokens: opts.output ?? 0,
            cache_read_input_tokens: opts.cacheRead ?? 0,
            cache_creation_input_tokens: opts.cacheWrite ?? 0,
          }
        : undefined,
    },
  };
}

function makeSession(records: JsonlRecord[]): ParsedSession {
  const messageCount = records.filter((r) => r.type === 'user' || r.type === 'assistant').length;
  const toolCallCount = records.reduce((acc, r) => {
    if (r.type !== 'assistant') return acc;
    const a = r as AssistantRecord;
    if (!Array.isArray(a.message.content)) return acc;
    return acc + a.message.content.filter((b) => b.type === 'tool_use').length;
  }, 0);
  return {
    sessionId: 's1',
    records,
    messageCount,
    toolCallCount,
    lastActivity: 0,
  };
}

describe('computeSessionMetrics', () => {
  it('빈 세션 → 모든 카운트 0', () => {
    const metrics = computeSessionMetrics(makeSession([]));
    expect(metrics.messageCount).toBe(0);
    expect(metrics.toolCallCount).toBe(0);
    expect(metrics.totalTokens).toBe(0);
    expect(metrics.cost).toBe(0);
    expect(metrics.toolDistribution.size).toBe(0);
  });

  it('user + assistant(usage) → token/cost 집계 정확', () => {
    const metrics = computeSessionMetrics(
      makeSession([
        userRec('u1'),
        assistantRec({
          uuid: 'a1',
          model: 'claude-opus-4-6',
          input: 1_000_000, // $15
          output: 1_000_000, // $75
        }),
      ])
    );
    expect(metrics.messageCount).toBe(2);
    expect(metrics.inputTokens).toBe(1_000_000);
    expect(metrics.outputTokens).toBe(1_000_000);
    expect(metrics.totalTokens).toBe(2_000_000);
    // Opus input $15 + output $75 = $90
    expect(metrics.cost).toBeCloseTo(90, 2);
  });

  it('여러 tool_use → toolDistribution 카운팅', () => {
    const metrics = computeSessionMetrics(
      makeSession([
        assistantRec({ uuid: 'a1', tools: ['Read', 'Read', 'Grep'] }),
        assistantRec({ uuid: 'a2', tools: ['Read', 'Bash'] }),
      ])
    );
    expect(metrics.toolDistribution.get('Read')).toBe(3);
    expect(metrics.toolDistribution.get('Grep')).toBe(1);
    expect(metrics.toolDistribution.get('Bash')).toBe(1);
    expect(metrics.toolCallCount).toBe(5);
  });

  it('알 수 없는 모델 → DEFAULT_PRICING (Sonnet 수준)', () => {
    const metrics = computeSessionMetrics(
      makeSession([
        assistantRec({
          uuid: 'a1',
          model: 'claude-future-x',
          input: 1_000_000,
          output: 0,
        }),
      ])
    );
    // DEFAULT input = $3
    expect(metrics.cost).toBeCloseTo(3, 2);
  });

  it('usage 없는 assistant → cost 0, tool distribution만 집계', () => {
    const metrics = computeSessionMetrics(
      makeSession([assistantRec({ uuid: 'a1', tools: ['Read'] })])
    );
    expect(metrics.cost).toBe(0);
    expect(metrics.totalTokens).toBe(0);
    expect(metrics.toolDistribution.get('Read')).toBe(1);
  });

  it('cacheRead / cacheWrite 합산 — Opus 가격', () => {
    const metrics = computeSessionMetrics(
      makeSession([
        assistantRec({
          uuid: 'a1',
          cacheRead: 1_000_000, // Opus cacheRead $1.5
          cacheWrite: 1_000_000, // Opus cacheWrite $18.75
        }),
      ])
    );
    expect(metrics.cacheReadTokens).toBe(1_000_000);
    expect(metrics.cacheWriteTokens).toBe(1_000_000);
    expect(metrics.cost).toBeCloseTo(20.25, 2);
  });
});

describe('formatDiffValue', () => {
  it('정수 차이 포맷', () => {
    expect(formatDiffValue(759)).toBe('759');
    expect(formatDiffValue(-500)).toBe('-500');
    expect(formatDiffValue(0)).toBe('0');
  });

  it('K/M 단위 축약', () => {
    expect(formatDiffValue(1_500)).toBe('1.5K');
    expect(formatDiffValue(-2_000_000)).toBe('-2.0M');
  });

  it('NaN / Infinity → "—"', () => {
    expect(formatDiffValue(NaN)).toBe('—');
    expect(formatDiffValue(Infinity)).toBe('—');
    expect(formatDiffValue(-Infinity)).toBe('—');
  });

  it('소수점이 있는 정수 → Math.round', () => {
    expect(formatDiffValue(3.7)).toBe('4');
    expect(formatDiffValue(-3.4)).toBe('-3');
  });
});

describe('formatCostDiff', () => {
  it('양수 → $N.NN', () => {
    expect(formatCostDiff(198.19)).toBe('$198.19');
    expect(formatCostDiff(0)).toBe('$0.00');
  });

  it('음수 → -$N.NN', () => {
    expect(formatCostDiff(-50.5)).toBe('-$50.50');
  });

  it('NaN / Infinity → "—"', () => {
    expect(formatCostDiff(NaN)).toBe('—');
    expect(formatCostDiff(Infinity)).toBe('—');
  });

  it('부동소수점 noise 축약 ($198.19261574999987 → $198.19)', () => {
    expect(formatCostDiff(198.19261574999987)).toBe('$198.19');
  });
});
