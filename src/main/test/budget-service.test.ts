import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  loadBudgetSettings,
  saveBudgetSettings,
  evaluateBudgetAlerts,
  normalizeBudgetSettings,
  timestampToLocalDate,
  todayLocal,
} from '../budget-service';
import type { BudgetSettings, CostSummary } from '@shared/types';

const ROOT = join(tmpdir(), 'zm-budget-test');
const settingsFile = join(ROOT, 'budget-settings.json');

interface NotifyCall {
  title: string;
  body: string;
}

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

function makeSummary(byDay: { date: string; cost: number }[]): CostSummary {
  return {
    totalCost: byDay.reduce((a, d) => a + d.cost, 0),
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    byModel: [],
    byDay: byDay.map((d) => ({ ...d, requestCount: 0 })),
  };
}

describe('budget-service', () => {
  describe('load/save', () => {
    it('파일이 없으면 기본값을 반환한다', async () => {
      const settings = await loadBudgetSettings({ settingsFile });
      expect(settings.dailyUsd).toBeNull();
      expect(settings.monthlyUsd).toBeNull();
      expect(settings.alertPercent).toBe(80);
      expect(settings.lastNotifiedKeys).toEqual([]);
    });

    it('save 후 load 시 같은 값을 반환한다', async () => {
      const next: BudgetSettings = {
        dailyUsd: 5,
        monthlyUsd: 100,
        alertPercent: 90,
        lastNotifiedKeys: ['daily-2026-04-09-warn'],
      };
      await saveBudgetSettings(next, { settingsFile });
      const loaded = await loadBudgetSettings({ settingsFile });
      expect(loaded).toEqual(next);
    });

    it('잘못된 alertPercent는 기본값으로 보정된다', async () => {
      // 직접 파일에 잘못된 값을 쓰고 load
      const { writeFile, mkdir } = await import('fs/promises');
      const { dirname } = await import('path');
      await mkdir(dirname(settingsFile), { recursive: true });
      await writeFile(
        settingsFile,
        JSON.stringify({ dailyUsd: 1, monthlyUsd: 10, alertPercent: -5 }),
        'utf-8'
      );
      const loaded = await loadBudgetSettings({ settingsFile });
      expect(loaded.alertPercent).toBe(80); // 음수 → 기본값
    });
  });

  describe('evaluateBudgetAlerts', () => {
    const fixedNow = new Date('2026-04-09T12:00:00');
    const today = '2026-04-09';

    it('예산이 설정되지 않으면 알림 없음', async () => {
      const calls: NotifyCall[] = [];
      const summary = makeSummary([{ date: today, cost: 100 }]);
      const sent = await evaluateBudgetAlerts(
        summary,
        { settingsFile, notify: (title, body) => calls.push({ title, body }) },
        fixedNow
      );
      expect(sent).toEqual([]);
      expect(calls).toEqual([]);
    });

    it('일별 예산 80% 도달 시 경고 알림 1회', async () => {
      await saveBudgetSettings(
        {
          dailyUsd: 10,
          monthlyUsd: null,
          alertPercent: 80,
          lastNotifiedKeys: [],
        },
        { settingsFile }
      );
      const calls: NotifyCall[] = [];
      const summary = makeSummary([{ date: today, cost: 8 }]); // 80%

      const sent = await evaluateBudgetAlerts(
        summary,
        { settingsFile, notify: (title, body) => calls.push({ title, body }) },
        fixedNow
      );
      expect(sent).toContain('daily-2026-04-09-warn');
      expect(calls).toHaveLength(1);
      expect(calls[0].title).toContain('80%');

      // 두 번째 호출은 중복 발송 안 함
      const sent2 = await evaluateBudgetAlerts(
        summary,
        { settingsFile, notify: (title, body) => calls.push({ title, body }) },
        fixedNow
      );
      expect(sent2).toEqual([]);
      expect(calls).toHaveLength(1);
    });

    it('일별 예산 100% 초과 시 exceed 알림, warn은 발송 안 함', async () => {
      await saveBudgetSettings(
        {
          dailyUsd: 10,
          monthlyUsd: null,
          alertPercent: 80,
          lastNotifiedKeys: [],
        },
        { settingsFile }
      );
      const calls: NotifyCall[] = [];
      const summary = makeSummary([{ date: today, cost: 12 }]); // 120%

      const sent = await evaluateBudgetAlerts(
        summary,
        { settingsFile, notify: (title, body) => calls.push({ title, body }) },
        fixedNow
      );
      expect(sent).toEqual(['daily-2026-04-09-exceed']);
      expect(calls).toHaveLength(1);
      expect(calls[0].title).toContain('초과');
    });

    it('월별 예산도 독립적으로 평가된다', async () => {
      await saveBudgetSettings(
        {
          dailyUsd: null,
          monthlyUsd: 100,
          alertPercent: 80,
          lastNotifiedKeys: [],
        },
        { settingsFile }
      );
      const calls: NotifyCall[] = [];
      const summary = makeSummary([
        { date: '2026-04-01', cost: 30 },
        { date: '2026-04-05', cost: 30 },
        { date: today, cost: 25 }, // 합계 85 (85%)
      ]);

      const sent = await evaluateBudgetAlerts(
        summary,
        { settingsFile, notify: (title, body) => calls.push({ title, body }) },
        fixedNow
      );
      expect(sent).toEqual(['monthly-2026-04-warn']);
      expect(calls[0].title).toContain('이번 달');
    });

    it('임계 미도달 시 알림 없음', async () => {
      await saveBudgetSettings(
        {
          dailyUsd: 10,
          monthlyUsd: 100,
          alertPercent: 80,
          lastNotifiedKeys: [],
        },
        { settingsFile }
      );
      const calls: NotifyCall[] = [];
      const summary = makeSummary([{ date: today, cost: 5 }]); // 50%

      const sent = await evaluateBudgetAlerts(
        summary,
        { settingsFile, notify: (title, body) => calls.push({ title, body }) },
        fixedNow
      );
      expect(sent).toEqual([]);
      expect(calls).toEqual([]);
    });

    it('알림 발송 후 lastNotifiedKeys가 파일에 저장된다', async () => {
      await saveBudgetSettings(
        {
          dailyUsd: 10,
          monthlyUsd: null,
          alertPercent: 80,
          lastNotifiedKeys: [],
        },
        { settingsFile }
      );
      const summary = makeSummary([{ date: today, cost: 9 }]); // 90%

      await evaluateBudgetAlerts(summary, { settingsFile, notify: () => {} }, fixedNow);

      const raw = await readFile(settingsFile, 'utf-8');
      const persisted = JSON.parse(raw) as BudgetSettings;
      expect(persisted.lastNotifiedKeys).toContain('daily-2026-04-09-warn');
    });

    it('일별 + 월별 동시 임계 도달 시 2개 키 발송', async () => {
      await saveBudgetSettings(
        {
          dailyUsd: 10,
          monthlyUsd: 100,
          alertPercent: 80,
          lastNotifiedKeys: [],
        },
        { settingsFile }
      );
      const calls: NotifyCall[] = [];
      const summary = makeSummary([
        { date: '2026-04-01', cost: 40 },
        { date: '2026-04-05', cost: 40 },
        { date: today, cost: 9 }, // 오늘 90%, 이번 달 89
      ]);

      const sent = await evaluateBudgetAlerts(
        summary,
        { settingsFile, notify: (title, body) => calls.push({ title, body }) },
        fixedNow
      );
      expect(sent).toContain('daily-2026-04-09-warn');
      expect(sent).toContain('monthly-2026-04-warn');
      expect(calls).toHaveLength(2);
    });

    it('다음날이 되면 새 키로 재발송된다', async () => {
      await saveBudgetSettings(
        {
          dailyUsd: 10,
          monthlyUsd: null,
          alertPercent: 80,
          lastNotifiedKeys: [],
        },
        { settingsFile }
      );
      const calls: NotifyCall[] = [];
      const summary1 = makeSummary([{ date: '2026-04-09', cost: 9 }]);
      await evaluateBudgetAlerts(
        summary1,
        { settingsFile, notify: (title, body) => calls.push({ title, body }) },
        new Date('2026-04-09T12:00:00')
      );
      expect(calls).toHaveLength(1);

      // 다음날 — summary에도 새 날짜 포함
      const summary2 = makeSummary([
        { date: '2026-04-09', cost: 9 },
        { date: '2026-04-10', cost: 9 },
      ]);
      const sent2 = await evaluateBudgetAlerts(
        summary2,
        { settingsFile, notify: (title, body) => calls.push({ title, body }) },
        new Date('2026-04-10T12:00:00')
      );
      expect(sent2).toContain('daily-2026-04-10-warn');
      expect(calls).toHaveLength(2);
    });

    it('lastNotifiedKeys가 60개를 초과하면 trim된다', async () => {
      // 기존에 이미 59개가 있고, 이번에 새 키 2개가 추가되면 trim으로 60개 유지
      const existing = Array.from({ length: 59 }, (_, i) => `stale-${i}`);
      await saveBudgetSettings(
        {
          dailyUsd: 10,
          monthlyUsd: 100,
          alertPercent: 80,
          lastNotifiedKeys: existing,
        },
        { settingsFile }
      );
      const summary = makeSummary([
        { date: '2026-04-01', cost: 40 },
        { date: today, cost: 45 }, // 오늘 450%, 이번 달 85
      ]);
      await evaluateBudgetAlerts(summary, { settingsFile, notify: () => {} }, fixedNow);

      const loaded = await loadBudgetSettings({ settingsFile });
      expect(loaded.lastNotifiedKeys.length).toBeLessThanOrEqual(60);
      // 최신 2개 키는 포함되어야 함
      expect(loaded.lastNotifiedKeys).toContain('daily-2026-04-09-exceed');
      expect(loaded.lastNotifiedKeys).toContain('monthly-2026-04-warn');
      // 가장 오래된 키는 제거
      expect(loaded.lastNotifiedKeys).not.toContain('stale-0');
    });

    it('동시 호출(race) 시 알림이 중복 발송되지 않는다', async () => {
      await saveBudgetSettings(
        {
          dailyUsd: 10,
          monthlyUsd: null,
          alertPercent: 80,
          lastNotifiedKeys: [],
        },
        { settingsFile }
      );
      const calls: NotifyCall[] = [];
      const summary = makeSummary([{ date: today, cost: 9 }]); // 90%

      // 직렬화 체인으로 인해 두 호출 중 한 쪽만 실제 발송
      const [a, b] = await Promise.all([
        evaluateBudgetAlerts(
          summary,
          { settingsFile, notify: (t, body) => calls.push({ title: t, body }) },
          fixedNow
        ),
        evaluateBudgetAlerts(
          summary,
          { settingsFile, notify: (t, body) => calls.push({ title: t, body }) },
          fixedNow
        ),
      ]);

      const allSent = [...a, ...b];
      const warnCount = allSent.filter((k) => k === 'daily-2026-04-09-warn').length;
      expect(warnCount).toBe(1);
      expect(calls).toHaveLength(1);
    });
  });

  describe('normalizeBudgetSettings', () => {
    it('NaN/음수/잘못된 타입을 기본값으로 보정한다', () => {
      const result = normalizeBudgetSettings({
        dailyUsd: NaN,
        monthlyUsd: -5,
        alertPercent: 150,
        lastNotifiedKeys: 'not-an-array',
      });
      expect(result.dailyUsd).toBeNull();
      expect(result.monthlyUsd).toBeNull();
      expect(result.alertPercent).toBe(80); // 범위 밖 → 기본값
      expect(result.lastNotifiedKeys).toEqual([]);
    });

    it('유효한 값은 그대로 보존한다', () => {
      const result = normalizeBudgetSettings({
        dailyUsd: 5.5,
        monthlyUsd: 100,
        alertPercent: 90,
        lastNotifiedKeys: ['daily-2026-04-09-warn', 'monthly-2026-04-warn'],
      });
      expect(result).toEqual({
        dailyUsd: 5.5,
        monthlyUsd: 100,
        alertPercent: 90,
        lastNotifiedKeys: ['daily-2026-04-09-warn', 'monthly-2026-04-warn'],
      });
    });

    it('saveBudgetSettings가 저장 시점에 정규화한다', async () => {
      // 타입 회피해서 잘못된 값을 save에 전달
      const invalid = {
        dailyUsd: NaN,
        monthlyUsd: -1,
        alertPercent: 999,
        lastNotifiedKeys: [1, 2, 'valid'] as unknown as string[],
      } as BudgetSettings;

      const saved = await saveBudgetSettings(invalid, { settingsFile });
      expect(saved.dailyUsd).toBeNull();
      expect(saved.monthlyUsd).toBeNull();
      expect(saved.alertPercent).toBe(80);
      expect(saved.lastNotifiedKeys).toEqual(['valid']);

      // 파일에도 정규화된 값이 저장되었는지
      const loaded = await loadBudgetSettings({ settingsFile });
      expect(loaded).toEqual(saved);
    });
  });

  describe('timestampToLocalDate', () => {
    it('ISO 문자열을 로컬 YYYY-MM-DD로 변환', () => {
      // 타임존에 의존하지 않도록 로컬 Date 객체로 비교
      const d = new Date(2026, 3, 9, 15, 0, 0); // 2026-04-09 15:00 로컬
      const result = timestampToLocalDate(d.toISOString());
      expect(result).toBe(todayLocal(d));
    });

    it('epoch ms 숫자를 로컬 YYYY-MM-DD로 변환', () => {
      const d = new Date(2026, 3, 9, 10, 30, 0);
      expect(timestampToLocalDate(d.getTime())).toBe(todayLocal(d));
    });

    it('빈/undefined/null은 "unknown"', () => {
      expect(timestampToLocalDate('')).toBe('unknown');
      expect(timestampToLocalDate(undefined)).toBe('unknown');
      expect(timestampToLocalDate(null)).toBe('unknown');
    });

    it('파싱 불가 문자열은 "unknown"', () => {
      expect(timestampToLocalDate('not-a-date')).toBe('unknown');
    });
  });
});
