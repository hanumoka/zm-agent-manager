import { describe, it, expect } from 'vitest';
import { getCompletedAt, isSameLocalDay } from '@/lib/task-utils';
import type { TaskInfo, TaskEvent } from '@shared/types';

function task(events: TaskEvent[]): TaskInfo {
  return {
    taskId: 't1',
    subject: 's',
    description: '',
    activeForm: '',
    status: 'completed',
    sessionId: 'sid',
    projectName: 'p',
    createdAt: 0,
    events,
  };
}

describe('getCompletedAt', () => {
  it('events 없음 → null', () => {
    expect(getCompletedAt(task([]))).toBeNull();
  });

  it('create 이벤트만 → null', () => {
    const t = task([{ type: 'create', timestamp: 100, sessionId: 'sid' }]);
    expect(getCompletedAt(t)).toBeNull();
  });

  it('단일 completed 이벤트 → 해당 timestamp', () => {
    const t = task([
      { type: 'create', timestamp: 100, sessionId: 'sid' },
      { type: 'update', timestamp: 200, sessionId: 'sid', status: 'completed' },
    ]);
    expect(getCompletedAt(t)).toBe(200);
  });

  it('재완료 케이스(여러 completed 이벤트) → 가장 최신', () => {
    const t = task([
      { type: 'create', timestamp: 100, sessionId: 'sid' },
      { type: 'update', timestamp: 200, sessionId: 'sid', status: 'completed' },
      { type: 'update', timestamp: 300, sessionId: 'sid', status: 'in_progress' },
      { type: 'update', timestamp: 400, sessionId: 'sid', status: 'completed' },
    ]);
    expect(getCompletedAt(t)).toBe(400);
  });

  it('string timestamp → 올바른 파싱', () => {
    const t = task([
      {
        type: 'update',
        timestamp: '2026-04-12T15:30:00Z',
        sessionId: 'sid',
        status: 'completed',
      },
    ]);
    const expected = new Date('2026-04-12T15:30:00Z').getTime();
    expect(getCompletedAt(t)).toBe(expected);
  });
});

describe('isSameLocalDay', () => {
  it('같은 날 시각 차 → true', () => {
    const ts1 = new Date(2026, 3, 12, 9, 0, 0).getTime();
    const ts2 = new Date(2026, 3, 12, 18, 30, 0).getTime();
    expect(isSameLocalDay(ts1, ts2)).toBe(true);
  });

  it('날짜 경계 (23:59 vs 00:01) → false', () => {
    const ts1 = new Date(2026, 3, 12, 23, 59, 0).getTime();
    const ts2 = new Date(2026, 3, 13, 0, 1, 0).getTime();
    expect(isSameLocalDay(ts1, ts2)).toBe(false);
  });

  it('다른 달 → false', () => {
    const ts1 = new Date(2026, 2, 31, 12, 0, 0).getTime();
    const ts2 = new Date(2026, 3, 1, 12, 0, 0).getTime();
    expect(isSameLocalDay(ts1, ts2)).toBe(false);
  });
});
