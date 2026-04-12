import { describe, it, expect } from 'vitest';
import { mapTaskToStage, groupTasksByStage } from '@/lib/workflow-utils';
import type { TaskInfo, TaskMetadata, TaskStatus } from '@shared/types';

function task(id: string, status: TaskStatus): TaskInfo {
  return {
    taskId: id,
    subject: `task-${id}`,
    description: '',
    activeForm: '',
    status,
    sessionId: 'sid',
    projectName: 'p',
    createdAt: 0,
    events: [],
  };
}

describe('mapTaskToStage', () => {
  const stages = ['A', 'B', 'C', 'D', 'E'];

  it('명시적 metadata.workflowStage 우선', () => {
    const t = task('1', 'in_progress');
    const meta: TaskMetadata = { taskId: '1', workflowStage: 'C', updatedAt: 0 };
    expect(mapTaskToStage(t, meta, stages)).toBe('C');
  });

  it('metadata stage가 stages에 없으면 status fallback', () => {
    const t = task('1', 'pending');
    const meta: TaskMetadata = { taskId: '1', workflowStage: 'UNKNOWN', updatedAt: 0 };
    expect(mapTaskToStage(t, meta, stages)).toBe('A');
  });

  it('pending → 첫 단계', () => {
    expect(mapTaskToStage(task('1', 'pending'), undefined, stages)).toBe('A');
  });

  it('in_progress → 중간 단계', () => {
    // (5 - 1) / 2 = 2 → stages[2] = 'C'
    expect(mapTaskToStage(task('1', 'in_progress'), undefined, stages)).toBe('C');
  });

  it('completed → 마지막 단계', () => {
    expect(mapTaskToStage(task('1', 'completed'), undefined, stages)).toBe('E');
  });

  it('deleted → null', () => {
    expect(mapTaskToStage(task('1', 'deleted'), undefined, stages)).toBeNull();
  });

  it('stages 빈 배열 → null', () => {
    expect(mapTaskToStage(task('1', 'pending'), undefined, [])).toBeNull();
  });
});

describe('groupTasksByStage', () => {
  const stages = ['A', 'B', 'C'];

  it('빈 태스크 배열 → 모든 stage 빈 배열', () => {
    const result = groupTasksByStage([], new Map(), stages);
    expect(result.size).toBe(3);
    expect(result.get('A')).toEqual([]);
    expect(result.get('B')).toEqual([]);
    expect(result.get('C')).toEqual([]);
  });

  it('정상 그룹핑 — metadata + status 혼합', () => {
    const tasks = [
      task('1', 'pending'),
      task('2', 'in_progress'),
      task('3', 'completed'),
      task('4', 'deleted'), // 제외됨
    ];
    const metadataMap = new Map<string, TaskMetadata>([
      ['1', { taskId: '1', workflowStage: 'B', updatedAt: 0 }], // 명시적 B
    ]);
    const result = groupTasksByStage(tasks, metadataMap, stages);
    expect(result.get('A')?.map((t) => t.taskId)).toEqual([]); // 1이 B로 할당되어 pending 폴백 없음
    expect(result.get('B')?.map((t) => t.taskId)).toEqual(['1', '2']); // 1(explicit) + 2(in_progress 중간)
    expect(result.get('C')?.map((t) => t.taskId)).toEqual(['3']);
    // deleted(4)는 어디에도 없음
  });
});
