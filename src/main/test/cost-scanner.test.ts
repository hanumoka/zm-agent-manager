import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { scanCostSummary } from '../cost-scanner';

const ROOT = join(tmpdir(), 'zm-cost-test');

interface AssistantRecord {
  type: 'assistant';
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  message: {
    role: 'assistant';
    model: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
}

function makeAssistant(opts: {
  sessionId: string;
  timestamp: string;
  model: string;
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
}): AssistantRecord {
  return {
    type: 'assistant',
    uuid: 'u-' + Math.random().toString(36).slice(2, 10),
    parentUuid: null,
    sessionId: opts.sessionId,
    timestamp: opts.timestamp,
    message: {
      role: 'assistant',
      model: opts.model,
      usage: {
        input_tokens: opts.input,
        output_tokens: opts.output,
        cache_read_input_tokens: opts.cacheRead ?? 0,
        cache_creation_input_tokens: opts.cacheWrite ?? 0,
      },
    },
  };
}

function writeFixture(
  projectsDir: string,
  encodedDir: string,
  sessionId: string,
  records: AssistantRecord[]
): void {
  const dir = join(projectsDir, encodedDir);
  mkdirSync(dir, { recursive: true });
  const lines = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  writeFileSync(join(dir, `${sessionId}.jsonl`), lines);
}

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('scanCostSummary', () => {
  it('빈 디렉토리는 zero 요약 반환', async () => {
    const projectsDir = join(ROOT, 'empty');
    mkdirSync(projectsDir, { recursive: true });
    const summary = await scanCostSummary({ projectsDir });
    expect(summary.totalCost).toBe(0);
    expect(summary.totalRequests).toBe(0);
    expect(summary.byModel).toEqual([]);
    expect(summary.byDay).toEqual([]);
  });

  it('단일 레코드로 비용 계산 정확성 (Opus)', async () => {
    const projectsDir = join(ROOT, 'single');
    mkdirSync(projectsDir, { recursive: true });
    writeFixture(projectsDir, '-Users-foo-myproject', 's1', [
      makeAssistant({
        sessionId: 's1',
        timestamp: '2026-04-09T12:00:00Z',
        model: 'claude-opus-4-6',
        input: 1_000_000, // 1M input → $15
        output: 1_000_000, // 1M output → $75
      }),
    ]);

    const summary = await scanCostSummary({ projectsDir });
    // Opus: input $15 + output $75 = $90
    expect(summary.totalCost).toBeCloseTo(90, 2);
    expect(summary.totalRequests).toBe(1);
    expect(summary.totalInputTokens).toBe(1_000_000);
    expect(summary.totalOutputTokens).toBe(1_000_000);
    expect(summary.byModel).toHaveLength(1);
    expect(summary.byModel[0].model).toBe('claude-opus-4-6');
    expect(summary.byModel[0].cost).toBeCloseTo(90, 2);
  });

  it('다중 모델 집계 — Sonnet과 Opus 분리', async () => {
    const projectsDir = join(ROOT, 'multi-model');
    mkdirSync(projectsDir, { recursive: true });
    writeFixture(projectsDir, '-Users-foo-myproject', 's1', [
      makeAssistant({
        sessionId: 's1',
        timestamp: '2026-04-09T12:00:00Z',
        model: 'claude-opus-4-6',
        input: 1_000_000,
        output: 0,
      }),
      makeAssistant({
        sessionId: 's1',
        timestamp: '2026-04-09T12:00:01Z',
        model: 'claude-sonnet-4-6',
        input: 1_000_000, // Sonnet input $3
        output: 0,
      }),
    ]);

    const summary = await scanCostSummary({ projectsDir });
    expect(summary.byModel).toHaveLength(2);
    const opus = summary.byModel.find((m) => m.model === 'claude-opus-4-6')!;
    const sonnet = summary.byModel.find((m) => m.model === 'claude-sonnet-4-6')!;
    expect(opus.cost).toBeCloseTo(15, 2);
    expect(sonnet.cost).toBeCloseTo(3, 2);
    expect(summary.totalCost).toBeCloseTo(18, 2);
  });

  it('일별 집계 — 로컬 시각 기준으로 날짜 키 생성', async () => {
    const projectsDir = join(ROOT, 'by-day');
    mkdirSync(projectsDir, { recursive: true });
    // 로컬 시각 명시 — 타임존 독립적으로 2026-04-09 12:00
    const local = new Date(2026, 3, 9, 12, 0, 0);
    writeFixture(projectsDir, '-Users-foo-myproject', 's1', [
      makeAssistant({
        sessionId: 's1',
        timestamp: local.toISOString(),
        model: 'claude-opus-4-6',
        input: 1_000_000,
        output: 0,
      }),
    ]);

    const summary = await scanCostSummary({ projectsDir });
    expect(summary.byDay).toHaveLength(1);
    // 로컬 "YYYY-MM-DD" 포맷
    const expected = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
    expect(summary.byDay[0].date).toBe(expected);
    expect(summary.byDay[0].cost).toBeCloseTo(15, 2);
  });

  it('빈 timestamp는 byDay에서 제외되지만 totalCost에는 포함', async () => {
    // cost-scanner는 'unknown' 날짜를 byDay에서 명시적으로 필터링한다.
    // 모델별/총합 집계에는 여전히 포함되어 사용자가 누락된 비용을 모르지 않도록 한다.
    const projectsDir = join(ROOT, 'unknown-ts');
    mkdirSync(projectsDir, { recursive: true });
    writeFixture(projectsDir, '-Users-foo-myproject', 's1', [
      makeAssistant({
        sessionId: 's1',
        timestamp: '',
        model: 'claude-opus-4-6',
        input: 1_000_000,
        output: 0,
      }),
    ]);

    const summary = await scanCostSummary({ projectsDir });
    expect(summary.byDay).toHaveLength(0); // unknown 제외
    expect(summary.totalCost).toBeCloseTo(15, 2); // 전체 합산은 포함
    expect(summary.totalRequests).toBe(1);
    expect(summary.byModel).toHaveLength(1);
  });

  it('알 수 없는 모델은 DEFAULT_PRICING(Sonnet 수준) 적용', async () => {
    const projectsDir = join(ROOT, 'unknown-model');
    mkdirSync(projectsDir, { recursive: true });
    writeFixture(projectsDir, '-Users-foo-myproject', 's1', [
      makeAssistant({
        sessionId: 's1',
        timestamp: '2026-04-09T12:00:00Z',
        model: 'claude-future-model-9',
        input: 1_000_000,
        output: 0,
      }),
    ]);

    const summary = await scanCostSummary({ projectsDir });
    // DEFAULT_PRICING.input = 3 (Sonnet 수준)
    expect(summary.totalCost).toBeCloseTo(3, 2);
  });

  it('캐시 토큰 비용도 집계에 포함', async () => {
    const projectsDir = join(ROOT, 'cache');
    mkdirSync(projectsDir, { recursive: true });
    writeFixture(projectsDir, '-Users-foo-myproject', 's1', [
      makeAssistant({
        sessionId: 's1',
        timestamp: '2026-04-09T12:00:00Z',
        model: 'claude-opus-4-6',
        input: 0,
        output: 0,
        cacheRead: 1_000_000, // Opus cacheRead $1.5
        cacheWrite: 1_000_000, // Opus cacheWrite $18.75
      }),
    ]);

    const summary = await scanCostSummary({ projectsDir });
    // 1.5 + 18.75 = 20.25
    expect(summary.totalCost).toBeCloseTo(20.25, 2);
    expect(summary.byModel[0].cacheReadTokens).toBe(1_000_000);
    expect(summary.byModel[0].cacheWriteTokens).toBe(1_000_000);
  });

  it('다중 프로젝트 — 모든 프로젝트의 비용 합산', async () => {
    const projectsDir = join(ROOT, 'multi-project');
    mkdirSync(projectsDir, { recursive: true });
    writeFixture(projectsDir, '-Users-foo-alpha', 's-a', [
      makeAssistant({
        sessionId: 's-a',
        timestamp: '2026-04-09T12:00:00Z',
        model: 'claude-opus-4-6',
        input: 1_000_000,
        output: 0,
      }),
    ]);
    writeFixture(projectsDir, '-Users-foo-beta', 's-b', [
      makeAssistant({
        sessionId: 's-b',
        timestamp: '2026-04-09T12:00:00Z',
        model: 'claude-opus-4-6',
        input: 1_000_000,
        output: 0,
      }),
    ]);

    const summary = await scanCostSummary({ projectsDir });
    expect(summary.totalCost).toBeCloseTo(30, 2);
    expect(summary.totalRequests).toBe(2);
  });
});
