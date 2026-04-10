import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { TaskMetadata } from '@shared/types';

const DEFAULT_METADATA_DIR = join(homedir(), '.zm-agent-manager', 'task-metadata');

/** 테스트에서 fixture 경로 주입. */
export interface TaskMetadataOptions {
  metadataDir?: string;
}

function resolveDir(options: TaskMetadataOptions): string {
  return options.metadataDir ?? DEFAULT_METADATA_DIR;
}

function resolveFile(taskId: string, options: TaskMetadataOptions): string {
  // taskId는 "sessionId:N" 형식. 파일명에 ':'은 문제될 수 있으므로 치환
  const safeId = taskId.replace(/:/g, '_');
  return join(resolveDir(options), `${safeId}.json`);
}

/** 단일 태스크의 메타데이터 읽기. 없으면 기본값 반환. */
export async function getTaskMetadata(
  taskId: string,
  options: TaskMetadataOptions = {}
): Promise<TaskMetadata> {
  const file = resolveFile(taskId, options);
  try {
    const raw = await readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<TaskMetadata>;
    return {
      taskId,
      severity: parsed.severity,
      type: parsed.type,
      workflowStage: parsed.workflowStage,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return { taskId, updatedAt: 0 };
  }
}

/** 단일 태스크의 메타데이터 저장. 디렉토리가 없으면 생성. */
export async function setTaskMetadata(
  metadata: TaskMetadata,
  options: TaskMetadataOptions = {}
): Promise<TaskMetadata> {
  const file = resolveFile(metadata.taskId, options);
  const toSave: TaskMetadata = {
    ...metadata,
    updatedAt: Date.now(),
  };
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(toSave, null, 2), 'utf-8');
  return toSave;
}
