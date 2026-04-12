import type { TaskInfo } from '@shared/types';

/** `string | number` timestamp를 ms number로 정규화. 파싱 실패 시 `0`. */
function tsToMs(t: string | number): number {
  if (typeof t === 'number') return t;
  const parsed = new Date(t).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 태스크의 "완료 시각"을 추출.
 * `events` 배열에서 `status === 'completed'`인 이벤트 중 가장 최신 timestamp 반환.
 *
 * 재완료 케이스(completed → in_progress → completed)는 마지막 completed 이벤트만 사용.
 *
 * @returns 최신 completed 이벤트의 ms timestamp. 없으면 `null`
 */
export function getCompletedAt(task: TaskInfo): number | null {
  let latest: number | null = null;
  for (const e of task.events) {
    if (e.status !== 'completed') continue;
    const ms = tsToMs(e.timestamp);
    if (latest === null || ms > latest) latest = ms;
  }
  return latest;
}

/**
 * 두 timestamp가 로컬 시간 기준 동일한 "오늘"인지 판정.
 * 타임존 경계 이슈 없이 `Date` 객체의 getFullYear/getMonth/getDate로 비교.
 */
export function isSameLocalDay(ts: number, now: number): boolean {
  const d1 = new Date(ts);
  const d2 = new Date(now);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}
