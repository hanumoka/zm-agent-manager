import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadBudgetSettings, saveBudgetSettings, evaluateBudgetAlerts } from '../budget-service';
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
  });
});
