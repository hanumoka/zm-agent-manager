import { readdir, stat } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from 'os';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import type { TaskInfo, TaskStatus, TaskEvent } from '@shared/types';
import { parseHistoryFile } from './history-parser';

const DEFAULT_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

/** 테스트에서 fixture 디렉토리 주입. */
export interface TaskScannerOptions {
  /** JSONL이 들어있는 루트 디렉토리. 기본값: `~/.claude/projects` */
  projectsDir?: string;
  /** history.jsonl 경로. 기본값: `~/.claude/history.jsonl` */
  historyFile?: string;
}

interface RawTaskCreate {
  subject: string;
  description: string;
  activeForm: string;
}

interface RawTaskUpdate {
  taskId: string;
  status: TaskStatus;
}

/**
 * 단일 JSONL 파일에서 TaskCreate/TaskUpdate 이벤트 추출
 */
async function extractTasksFromJsonl(
  filePath: string,
  sessionId: string,
  projectName: string
): Promise<TaskInfo[]> {
  const creates: { input: RawTaskCreate; timestamp: string | number }[] = [];
  const updates: { input: RawTaskUpdate; timestamp: string | number }[] = [];

  let stream;
  let rl;

  try {
    stream = createReadStream(filePath, { encoding: 'utf-8' });
    rl = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;

      // 빠른 사전 필터: TaskCreate 또는 TaskUpdate가 포함된 라인만 파싱
      if (!line.includes('TaskCreate') && !line.includes('TaskUpdate')) continue;

      try {
        const raw = JSON.parse(line) as Record<string, unknown>;
        if (raw.type !== 'assistant') continue;

        const message = raw.message as { content?: unknown[] } | undefined;
        if (!message?.content || !Array.isArray(message.content)) continue;

        const timestamp = (raw.timestamp as string | number) ?? '';

        for (const block of message.content) {
          const b = block as { type?: string; name?: string; input?: Record<string, unknown> };
          if (b.type !== 'tool_use') continue;

          if (b.name === 'TaskCreate' && b.input) {
            creates.push({
              input: b.input as unknown as RawTaskCreate,
              timestamp,
            });
          } else if (b.name === 'TaskUpdate' && b.input) {
            updates.push({
              input: b.input as unknown as RawTaskUpdate,
              timestamp,
            });
          }
        }
      } catch {
        // 파싱 실패 스킵
      }
    }
  } finally {
    rl?.close();
    stream?.destroy();
  }

  // TaskCreate 순서로 taskId 매핑 (1-based)
  const tasks: TaskInfo[] = creates.map((create, index) => {
    const taskId = String(index + 1);

    const events: TaskEvent[] = [
      { type: 'create', timestamp: create.timestamp, sessionId, status: 'pending' },
    ];

    // 해당 taskId의 업데이트 이벤트 수집
    const taskUpdates = updates.filter((u) => u.input.taskId === taskId);
    let currentStatus: TaskStatus = 'pending';

    for (const update of taskUpdates) {
      currentStatus = update.input.status;
      events.push({
        type: 'update',
        timestamp: update.timestamp,
        sessionId,
        status: update.input.status,
      });
    }

    return {
      taskId: `${sessionId}:${taskId}`,
      subject: create.input.subject ?? '',
      description: create.input.description ?? '',
      activeForm: create.input.activeForm ?? '',
      status: currentStatus,
      sessionId,
      projectName,
      createdAt: create.timestamp,
      events,
    };
  });

  return tasks;
}

/**
 * 모든 세션에서 태스크를 스캔하여 반환
 */
export async function scanAllTasks(options: TaskScannerOptions = {}): Promise<TaskInfo[]> {
  const projectsDir = options.projectsDir ?? DEFAULT_PROJECTS_DIR;
  const { projectPathMap } = await parseHistoryFile(options.historyFile);
  const allTasks: TaskInfo[] = [];

  let projectDirs: string[];
  try {
    projectDirs = await readdir(projectsDir);
  } catch {
    return [];
  }

  for (const encodedDir of projectDirs) {
    const projectDir = join(projectsDir, encodedDir);

    try {
      const s = await stat(projectDir);
      if (!s.isDirectory()) continue;
    } catch {
      continue;
    }

    const projectPath = projectPathMap.get(encodedDir) ?? encodedDir;
    const projectName = projectPathMap.has(encodedDir)
      ? basename(projectPath)
      : (encodedDir.split('-').pop() ?? encodedDir);

    let files: string[];
    try {
      files = await readdir(projectDir);
    } catch {
      continue;
    }

    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

    // 각 JSONL 파일에서 태스크 추출 (병렬)
    const results = await Promise.all(
      jsonlFiles.map(async (jsonlFile) => {
        const sessionId = jsonlFile.replace('.jsonl', '');
        const filePath = join(projectDir, jsonlFile);
        return extractTasksFromJsonl(filePath, sessionId, projectName);
      })
    );

    for (const tasks of results) {
      allTasks.push(...tasks);
    }
  }

  // 생성 시간 역순 정렬 (최신 먼저)
  allTasks.sort((a, b) => {
    const tsA = typeof a.createdAt === 'number' ? a.createdAt : new Date(a.createdAt).getTime();
    const tsB = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.createdAt).getTime();
    return tsB - tsA;
  });

  return allTasks;
}
