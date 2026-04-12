import { describe, it, expect } from 'vitest';
import { pickLatestPlanPerProject } from '@/lib/plan-utils';
import type { PlanInfo } from '@shared/types';

function plan(
  projectName: string,
  timestamp: number | string,
  title = 't'
): PlanInfo {
  return {
    title,
    content: '',
    filePath: `/fake/${projectName}/${title}.md`,
    allowedPrompts: [],
    timestamp,
    sessionId: `${projectName}-${String(timestamp)}`,
    projectName,
  };
}

describe('pickLatestPlanPerProject', () => {
  it('빈 배열 → 빈 배열', () => {
    expect(pickLatestPlanPerProject([])).toEqual([]);
  });

  it('단일 프로젝트 3개 플랜 → 가장 최신 1개만 반환', () => {
    const result = pickLatestPlanPerProject([
      plan('proj-a', 100),
      plan('proj-a', 300),
      plan('proj-a', 200),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe(300);
  });

  it('3개 프로젝트 각 2개 플랜 → 3개 반환, 프로젝트당 최신, timestamp desc 정렬', () => {
    const result = pickLatestPlanPerProject([
      plan('proj-a', 100),
      plan('proj-a', 500),
      plan('proj-b', 200),
      plan('proj-b', 800),
      plan('proj-c', 300),
      plan('proj-c', 600),
    ]);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.projectName)).toEqual(['proj-b', 'proj-c', 'proj-a']);
    expect(result.map((r) => r.timestamp)).toEqual([800, 600, 500]);
  });

  it('timestamp string/number 혼합 → 올바른 비교', () => {
    const result = pickLatestPlanPerProject([
      plan('proj-a', '2026-04-10T00:00:00Z'),
      plan('proj-a', '2026-04-12T00:00:00Z'),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe('2026-04-12T00:00:00Z');
  });

  it('파싱 불가능한 string timestamp → 0으로 취급 (밀려남)', () => {
    const result = pickLatestPlanPerProject([
      plan('proj-a', 'not-a-date'),
      plan('proj-a', 100),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe(100);
  });
});
