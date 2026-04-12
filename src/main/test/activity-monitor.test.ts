import { describe, it, expect } from 'vitest';
import {
  computeStuckCandidates,
  shouldNotifyUncommitted,
  computeZombieCandidates,
} from '../activity-monitor';

describe('computeStuckCandidates', () => {
  const nowMs = 1_000_000_000;
  const session = (id: string, ageMinutes: number): {
    sessionId: string;
    filePath: string;
    mtime: number;
    cwd: string;
  } => ({
    sessionId: id,
    filePath: `/path/${id}.jsonl`,
    mtime: nowMs - ageMinutes * 60_000,
    cwd: '/some/project',
  });

  it('15분 미만 경과 세션은 stuck 아님', () => {
    const result = computeStuckCandidates([session('a', 5), session('b', 14)], nowMs);
    expect(result).toHaveLength(0);
  });

  it('15분 이상 경과 세션만 stuck', () => {
    const result = computeStuckCandidates(
      [session('a', 5), session('b', 20), session('c', 60)],
      nowMs
    );
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.sessionId)).toEqual(['b', 'c']);
  });

  it('thresholdMs 커스텀', () => {
    const result = computeStuckCandidates([session('a', 4)], nowMs, 3 * 60_000);
    expect(result).toHaveLength(1);
  });
});

describe('shouldNotifyUncommitted', () => {
  const nowMs = 1_000_000_000;

  it('임계 미만 → false', () => {
    const lastNotified = new Map<string, number>();
    expect(shouldNotifyUncommitted('/p', 49, lastNotified, nowMs)).toBe(false);
  });

  it('임계 이상 + 이전 알림 없음 → true', () => {
    const lastNotified = new Map<string, number>();
    expect(shouldNotifyUncommitted('/p', 50, lastNotified, nowMs)).toBe(true);
  });

  it('debounce 내 재알림 → false', () => {
    const lastNotified = new Map<string, number>([['/p', nowMs - 30 * 60_000]]); // 30분 전
    expect(shouldNotifyUncommitted('/p', 100, lastNotified, nowMs)).toBe(false);
  });

  it('debounce 경과 → true', () => {
    const lastNotified = new Map<string, number>([['/p', nowMs - 2 * 60 * 60_000]]); // 2시간 전
    expect(shouldNotifyUncommitted('/p', 100, lastNotified, nowMs)).toBe(true);
  });
});

describe('computeZombieCandidates', () => {
  const session = (file: string, pid: number, sessionId: string): {
    file: string;
    pid: number;
    sessionId: string;
  } => ({ file, pid, sessionId });

  it('live pid은 좀비 아님', () => {
    const result = computeZombieCandidates(
      [session('1.json', 100, 'sid-1'), session('2.json', 200, 'sid-2')],
      new Set([100, 200])
    );
    expect(result).toHaveLength(0);
  });

  it('dead pid만 좀비', () => {
    const result = computeZombieCandidates(
      [session('1.json', 100, 'sid-1'), session('2.json', 200, 'sid-2')],
      new Set([100])
    );
    expect(result).toHaveLength(1);
    expect(result[0].pid).toBe(200);
    expect(result[0].sessionId).toBe('sid-2');
  });

  it('모두 dead', () => {
    const result = computeZombieCandidates(
      [session('1.json', 100, 'sid-1'), session('2.json', 200, 'sid-2')],
      new Set([999])
    );
    expect(result).toHaveLength(2);
  });
});
