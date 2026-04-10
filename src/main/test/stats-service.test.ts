import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { scanStatsSummary } from '../stats-service';

const ROOT = join(tmpdir(), 'zm-stats-test');

interface UserRecord {
  type: 'user';
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  message: { role: 'user'; content: string };
}

interface AssistantRecord {
  type: 'assistant';
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  message: {
    role: 'assistant';
    model?: string;
    content: unknown[];
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
}

type FixtureRecord = UserRecord | AssistantRecord;

let counter = 0;
function uid(): string {
  counter += 1;
  return `u-${counter}`;
}

function userMsg(sessionId: string, timestamp: string, content = 'hi'): UserRecord {
  return {
    type: 'user',
    uuid: uid(),
    parentUuid: null,
    sessionId,
    timestamp,
    message: { role: 'user', content },
  };
}

function assistantMsg(opts: {
  sessionId: string;
  timestamp: string;
  model?: string;
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  tools?: number;
}): AssistantRecord {
  const tools = opts.tools ?? 0;
  const content: unknown[] = [{ type: 'text', text: 'ok' }];
  for (let i = 0; i < tools; i++) {
    content.push({ type: 'tool_use', id: `t-${uid()}`, name: 'Read', input: {} });
  }
  return {
    type: 'assistant',
    uuid: uid(),
    parentUuid: null,
    sessionId: opts.sessionId,
    timestamp: opts.timestamp,
    message: {
      role: 'assistant',
      model: opts.model ?? 'claude-opus-4-6',
      content,
      usage:
        opts.input !== undefined || opts.output !== undefined
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

function writeFixture(
  projectsDir: string,
  encodedDir: string,
  sessionId: string,
  records: FixtureRecord[]
): void {
  const dir = join(projectsDir, encodedDir);
  mkdirSync(dir, { recursive: true });
  const lines = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  writeFileSync(join(dir, `${sessionId}.jsonl`), lines);
}

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });
  counter = 0;
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('scanStatsSummary', () => {
  it('빈 디렉토리 → zero 요약 + 빈 dailyActivity 윈도우', async () => {
    const projectsDir = join(ROOT, 'empty');
    mkdirSync(projectsDir, { recursive: true });
    const summary = await scanStatsSummary({
      projectsDir,
      historyFile: '/nonexistent',
      dailyWindowDays: 7,
    });
    expect(summary.totalSessions).toBe(0);
    expect(summary.totalMessages).toBe(0);
    expect(summary.totalTokens).toBe(0);
    expect(summary.totalToolCalls).toBe(0);
    expect(summary.dailyActivity).toHaveLength(7); // 윈도우 크기만큼 채워짐
    expect(summary.heatmap).toHaveLength(7 * 24);
    expect(summary.byProject).toEqual([]);
    expect(summary.byModel).toEqual([]);
  });

  it('단일 세션 — messageCount / toolCallCount / tokens 정확히 집계', async () => {
    const projectsDir = join(ROOT, 'single');
    writeFixture(projectsDir, '-Users-foo-myproject', 's1', [
      userMsg('s1', '2026-04-09T10:00:00Z', '첫 프롬프트'),
      assistantMsg({
        sessionId: 's1',
        timestamp: '2026-04-09T10:00:01Z',
        input: 100,
        output: 200,
        cacheRead: 50,
        cacheWrite: 25,
        tools: 3,
      }),
      assistantMsg({
        sessionId: 's1',
        timestamp: '2026-04-09T10:00:02Z',
        input: 10,
        output: 20,
        tools: 1,
      }),
    ]);

    const summary = await scanStatsSummary({
      projectsDir,
      historyFile: '/nonexistent',
      dailyWindowDays: 30,
    });

    expect(summary.totalSessions).toBe(1);
    expect(summary.totalMessages).toBe(3); // user + 2 assistant
    expect(summary.totalToolCalls).toBe(4); // 3 + 1
    expect(summary.totalTokens).toBe(100 + 200 + 50 + 25 + 10 + 20);
    expect(summary.byModel).toHaveLength(1);
    expect(summary.byModel[0].model).toBe('claude-opus-4-6');
    expect(summary.byProject).toHaveLength(1);
    expect(summary.byProject[0].projectName).toBe('myproject');
    expect(summary.byProject[0].messageCount).toBe(3);
  });

  it('다중 모델 — byModel이 totalTokens 내림차순', async () => {
    const projectsDir = join(ROOT, 'multi-model');
    writeFixture(projectsDir, '-Users-foo-myproject', 's1', [
      assistantMsg({
        sessionId: 's1',
        timestamp: '2026-04-09T10:00:00Z',
        model: 'claude-sonnet-4-6',
        input: 100,
        output: 100,
      }),
      assistantMsg({
        sessionId: 's1',
        timestamp: '2026-04-09T10:00:01Z',
        model: 'claude-opus-4-6',
        input: 500,
        output: 500,
      }),
      assistantMsg({
        sessionId: 's1',
        timestamp: '2026-04-09T10:00:02Z',
        model: 'claude-haiku-4-5-20251001',
        input: 10,
        output: 10,
      }),
    ]);

    const summary = await scanStatsSummary({
      projectsDir,
      historyFile: '/nonexistent',
    });

    expect(summary.byModel).toHaveLength(3);
    // 내림차순: Opus(1000) > Sonnet(200) > Haiku(20)
    expect(summary.byModel[0].model).toBe('claude-opus-4-6');
    expect(summary.byModel[0].totalTokens).toBe(1000);
    expect(summary.byModel[1].model).toBe('claude-sonnet-4-6');
    expect(summary.byModel[2].model).toBe('claude-haiku-4-5-20251001');
  });

  it('다중 프로젝트 — byProject가 cost 내림차순', async () => {
    const projectsDir = join(ROOT, 'multi-project');
    writeFixture(projectsDir, '-Users-foo-alpha', 's-a', [
      assistantMsg({
        sessionId: 's-a',
        timestamp: '2026-04-09T10:00:00Z',
        model: 'claude-opus-4-6',
        input: 1_000_000,
        output: 0,
      }),
    ]);
    writeFixture(projectsDir, '-Users-foo-beta', 's-b', [
      assistantMsg({
        sessionId: 's-b',
        timestamp: '2026-04-09T10:00:00Z',
        model: 'claude-sonnet-4-6',
        input: 1_000_000,
        output: 0,
      }),
    ]);

    const summary = await scanStatsSummary({
      projectsDir,
      historyFile: '/nonexistent',
    });

    expect(summary.byProject).toHaveLength(2);
    // Opus($15) > Sonnet($3)
    expect(summary.byProject[0].projectName).toBe('alpha');
    expect(summary.byProject[0].cost).toBeCloseTo(15, 2);
    expect(summary.byProject[1].projectName).toBe('beta');
    expect(summary.byProject[1].cost).toBeCloseTo(3, 2);
  });

  it('dailyActivity — 최근 N일 윈도우가 정확히 채워지고 일별 메시지 카운트가 집계된다', async () => {
    const projectsDir = join(ROOT, 'daily');
    // 로컬 시각으로 오늘
    const localToday = new Date();
    const localTodayIso = localToday.toISOString();

    writeFixture(projectsDir, '-Users-foo-myproject', 's1', [
      userMsg('s1', localTodayIso, '오늘 메시지'),
      assistantMsg({
        sessionId: 's1',
        timestamp: localTodayIso,
        tools: 2,
      }),
    ]);

    const summary = await scanStatsSummary({
      projectsDir,
      historyFile: '/nonexistent',
      dailyWindowDays: 7,
    });

    expect(summary.dailyActivity).toHaveLength(7);
    // 마지막 엔트리가 오늘이어야 함
    const todayKey = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;
    const lastEntry = summary.dailyActivity[summary.dailyActivity.length - 1];
    expect(lastEntry.date).toBe(todayKey);
    expect(lastEntry.messageCount).toBe(2);
    expect(lastEntry.toolCallCount).toBe(2);
    expect(lastEntry.sessionCount).toBe(1);
  });

  it('heatmap — 고정 크기 7×24 = 168개 셀', async () => {
    const projectsDir = join(ROOT, 'heatmap');
    mkdirSync(projectsDir, { recursive: true });

    const summary = await scanStatsSummary({
      projectsDir,
      historyFile: '/nonexistent',
    });

    expect(summary.heatmap).toHaveLength(7 * 24);
    // 모든 셀의 dayOfWeek/hour 범위 확인
    for (const cell of summary.heatmap) {
      expect(cell.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(cell.dayOfWeek).toBeLessThan(7);
      expect(cell.hour).toBeGreaterThanOrEqual(0);
      expect(cell.hour).toBeLessThan(24);
    }
  });

  it('usage 없는 assistant 레코드 — byModel에 포함되지 않지만 messageCount/toolCall은 포함', async () => {
    const projectsDir = join(ROOT, 'no-usage');
    writeFixture(projectsDir, '-Users-foo-myproject', 's1', [
      assistantMsg({
        sessionId: 's1',
        timestamp: '2026-04-09T10:00:00Z',
        tools: 1,
        // input/output 미지정 → usage undefined
      }),
    ]);

    const summary = await scanStatsSummary({
      projectsDir,
      historyFile: '/nonexistent',
    });

    expect(summary.totalMessages).toBe(1);
    expect(summary.totalToolCalls).toBe(1);
    expect(summary.totalTokens).toBe(0);
    expect(summary.byModel).toEqual([]);
  });

  it('빈 timestamp — 총합에는 포함되지만 dailyActivity/heatmap에서는 제외', async () => {
    const projectsDir = join(ROOT, 'empty-ts');
    writeFixture(projectsDir, '-Users-foo-myproject', 's1', [
      userMsg('s1', '', '시간 없음'),
      assistantMsg({
        sessionId: 's1',
        timestamp: '',
        input: 100,
        output: 100,
      }),
    ]);

    const summary = await scanStatsSummary({
      projectsDir,
      historyFile: '/nonexistent',
      dailyWindowDays: 7,
    });

    expect(summary.totalMessages).toBe(2); // 총합 포함
    expect(summary.totalTokens).toBe(200);
    // 윈도우 내 모든 엔트리는 0
    for (const d of summary.dailyActivity) {
      expect(d.messageCount).toBe(0);
    }
  });
});
