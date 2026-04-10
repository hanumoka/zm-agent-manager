import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { scanAllTasks } from '../task-scanner';

const ROOT = join(tmpdir(), 'zm-task-test');

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface AssistantRecord {
  type: 'assistant';
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  message: { role: 'assistant'; content: ToolUseBlock[] };
}

let counter = 0;
function uid(): string {
  counter += 1;
  return `u-${counter}`;
}

function taskCreate(
  sessionId: string,
  timestamp: string,
  subject: string,
  description = ''
): AssistantRecord {
  return {
    type: 'assistant',
    uuid: uid(),
    parentUuid: null,
    sessionId,
    timestamp,
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 't-' + uid(),
          name: 'TaskCreate',
          input: { subject, description, activeForm: subject + ' ing' },
        },
      ],
    },
  };
}

function taskUpdate(
  sessionId: string,
  timestamp: string,
  taskId: string,
  status: 'pending' | 'in_progress' | 'completed' | 'deleted'
): AssistantRecord {
  return {
    type: 'assistant',
    uuid: uid(),
    parentUuid: null,
    sessionId,
    timestamp,
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 't-' + uid(),
          name: 'TaskUpdate',
          input: { taskId, status },
        },
      ],
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
  counter = 0;
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('scanAllTasks', () => {
  it('빈 디렉토리는 빈 배열 반환', async () => {
    const projectsDir = join(ROOT, 'empty');
    mkdirSync(projectsDir, { recursive: true });
    const tasks = await scanAllTasks({ projectsDir, historyFile: '/nonexistent' });
    expect(tasks).toEqual([]);
  });

  it('TaskCreate 단건 → 1개 태스크 생성, 기본 상태 pending', async () => {
    const projectsDir = join(ROOT, 'single');
    writeFixture(projectsDir, '-Users-foo-myproject', 's1', [
      taskCreate('s1', '2026-04-09T10:00:00Z', '첫 번째 태스크'),
    ]);

    const tasks = await scanAllTasks({ projectsDir, historyFile: '/nonexistent' });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].subject).toBe('첫 번째 태스크');
    expect(tasks[0].status).toBe('pending');
    expect(tasks[0].sessionId).toBe('s1');
    expect(tasks[0].events).toHaveLength(1);
    expect(tasks[0].events[0].type).toBe('create');
  });

  it('TaskCreate + TaskUpdate → 상태 이력 추적', async () => {
    const projectsDir = join(ROOT, 'with-update');
    writeFixture(projectsDir, '-Users-foo-myproject', 's1', [
      taskCreate('s1', '2026-04-09T10:00:00Z', '진행 중 태스크'),
      taskUpdate('s1', '2026-04-09T10:01:00Z', '1', 'in_progress'),
      taskUpdate('s1', '2026-04-09T10:02:00Z', '1', 'completed'),
    ]);

    const tasks = await scanAllTasks({ projectsDir, historyFile: '/nonexistent' });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('completed');
    expect(tasks[0].events).toHaveLength(3);
    expect(tasks[0].events.map((e) => e.status)).toEqual(['pending', 'in_progress', 'completed']);
  });

  it('동일 세션 다중 TaskCreate — taskId가 1, 2, 3 순서로 매핑', async () => {
    const projectsDir = join(ROOT, 'multi-create');
    writeFixture(projectsDir, '-Users-foo-myproject', 's1', [
      taskCreate('s1', '2026-04-09T10:00:00Z', '태스크 A'),
      taskCreate('s1', '2026-04-09T10:00:01Z', '태스크 B'),
      taskCreate('s1', '2026-04-09T10:00:02Z', '태스크 C'),
      taskUpdate('s1', '2026-04-09T10:01:00Z', '2', 'in_progress'),
    ]);

    const tasks = await scanAllTasks({ projectsDir, historyFile: '/nonexistent' });
    expect(tasks).toHaveLength(3);
    const byIdSuffix = tasks.reduce<Record<string, (typeof tasks)[number]>>((acc, t) => {
      const suffix = t.taskId.split(':')[1];
      acc[suffix] = t;
      return acc;
    }, {});
    expect(byIdSuffix['1'].subject).toBe('태스크 A');
    expect(byIdSuffix['2'].subject).toBe('태스크 B');
    expect(byIdSuffix['2'].status).toBe('in_progress'); // taskId 2만 업데이트
    expect(byIdSuffix['3'].subject).toBe('태스크 C');
    expect(byIdSuffix['3'].status).toBe('pending');
  });

  it('다중 세션 — 세션별로 taskId 독립', async () => {
    const projectsDir = join(ROOT, 'multi-session');
    writeFixture(projectsDir, '-Users-foo-myproject', 's1', [
      taskCreate('s1', '2026-04-09T10:00:00Z', 'S1 태스크'),
      taskUpdate('s1', '2026-04-09T10:01:00Z', '1', 'completed'),
    ]);
    writeFixture(projectsDir, '-Users-foo-myproject', 's2', [
      taskCreate('s2', '2026-04-09T11:00:00Z', 'S2 태스크'),
    ]);

    const tasks = await scanAllTasks({ projectsDir, historyFile: '/nonexistent' });
    expect(tasks).toHaveLength(2);
    const s1 = tasks.find((t) => t.sessionId === 's1')!;
    const s2 = tasks.find((t) => t.sessionId === 's2')!;
    expect(s1.status).toBe('completed');
    expect(s2.status).toBe('pending');
    // taskId는 sessionId:N 형식이므로 충돌 없음
    expect(s1.taskId).toBe('s1:1');
    expect(s2.taskId).toBe('s2:1');
  });

  it('생성 시간 역순 정렬 (최신 먼저)', async () => {
    const projectsDir = join(ROOT, 'sort');
    writeFixture(projectsDir, '-Users-foo-myproject', 's1', [
      taskCreate('s1', '2026-04-08T10:00:00Z', '오래된 태스크'),
      taskCreate('s1', '2026-04-09T10:00:00Z', '최근 태스크'),
    ]);

    const tasks = await scanAllTasks({ projectsDir, historyFile: '/nonexistent' });
    expect(tasks).toHaveLength(2);
    expect(tasks[0].subject).toBe('최근 태스크');
    expect(tasks[1].subject).toBe('오래된 태스크');
  });

  it('TaskCreate / TaskUpdate가 없는 라인은 무시', async () => {
    const projectsDir = join(ROOT, 'no-task');
    writeFixture(projectsDir, '-Users-foo-myproject', 's1', [
      // Other tool — TaskCreate가 아니므로 무시되어야
      {
        type: 'assistant',
        uuid: uid(),
        parentUuid: null,
        sessionId: 's1',
        timestamp: '2026-04-09T10:00:00Z',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/foo' } }],
        },
      } as AssistantRecord,
    ]);

    const tasks = await scanAllTasks({ projectsDir, historyFile: '/nonexistent' });
    expect(tasks).toEqual([]);
  });
});
