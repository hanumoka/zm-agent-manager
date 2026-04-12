import { describe, it, expect } from 'vitest';
import { computePeriodComparison } from '@/lib/period-comparison';
import type { DailyCost } from '@shared/types';

function day(date: string, cost: number, requestCount = 10): DailyCost {
  return { date, cost, requestCount };
}

describe('computePeriodComparison', () => {
  it('빈 배열 → status=empty', () => {
    const result = computePeriodComparison([], 'week');
    expect(result.status).toBe('empty');
    expect(result.currentCost).toBe(0);
    expect(result.previousCost).toBe(0);
    expect(result.costChangePercent).toBe(0);
  });

  it('주간 정상 케이스 → 두 기간 합산 + 증감률 계산', () => {
    // 14일: prev 7일 각 1USD = 7, cur 7일 각 2USD = 14
    const byDay: DailyCost[] = [];
    for (let i = 0; i < 7; i++) byDay.push(day(`2026-03-${String(i + 1).padStart(2, '0')}`, 1, 5));
    for (let i = 0; i < 7; i++) byDay.push(day(`2026-03-${String(i + 8).padStart(2, '0')}`, 2, 10));

    const result = computePeriodComparison(byDay, 'week');
    expect(result.status).toBe('ok');
    expect(result.currentCost).toBeCloseTo(14, 5);
    expect(result.previousCost).toBeCloseTo(7, 5);
    expect(result.currentRequests).toBe(70);
    expect(result.previousRequests).toBe(35);
    expect(result.costChangePercent).toBeCloseTo(100, 5);
  });

  it('데이터 부족 (1기간만) → status=insufficient, previousCost=0', () => {
    const byDay: DailyCost[] = [];
    // 5일만 있어서 주간(7일) 이전 기간이 없음
    for (let i = 0; i < 5; i++) byDay.push(day(`2026-03-${String(i + 1).padStart(2, '0')}`, 1));
    const result = computePeriodComparison(byDay, 'week');
    expect(result.status).toBe('insufficient');
    expect(result.currentCost).toBeCloseTo(5, 5);
    expect(result.previousCost).toBe(0);
  });

  it('prev=0 && cur>0 → costChangePercent=Infinity (신규 활동)', () => {
    const byDay: DailyCost[] = [];
    // 이전 7일 모두 0, 최근 7일 각 1USD
    for (let i = 0; i < 7; i++) byDay.push(day(`2026-03-${String(i + 1).padStart(2, '0')}`, 0, 0));
    for (let i = 0; i < 7; i++) byDay.push(day(`2026-03-${String(i + 8).padStart(2, '0')}`, 1));
    const result = computePeriodComparison(byDay, 'week');
    expect(result.status).toBe('ok');
    expect(result.previousCost).toBe(0);
    expect(result.currentCost).toBeCloseTo(7, 5);
    expect(result.costChangePercent).toBe(Infinity);
  });

  it('감소 케이스 → 음수 증감률', () => {
    const byDay: DailyCost[] = [];
    for (let i = 0; i < 7; i++) byDay.push(day(`2026-03-${String(i + 1).padStart(2, '0')}`, 2));
    for (let i = 0; i < 7; i++) byDay.push(day(`2026-03-${String(i + 8).padStart(2, '0')}`, 1));
    const result = computePeriodComparison(byDay, 'week');
    expect(result.costChangePercent).toBeCloseTo(-50, 5);
  });

  it('월간 (30일) 토글', () => {
    const byDay: DailyCost[] = [];
    for (let i = 0; i < 60; i++) {
      byDay.push(day(`2026-02-${String((i % 28) + 1).padStart(2, '0')}-${i}`, i < 30 ? 1 : 2));
    }
    const result = computePeriodComparison(byDay, 'month');
    expect(result.status).toBe('ok');
    expect(result.currentCost).toBeCloseTo(60, 5); // last 30 × 2
    expect(result.previousCost).toBeCloseTo(30, 5); // prev 30 × 1
  });
});
