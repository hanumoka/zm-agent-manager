import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
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
      workflowName: parsed.workflowName,
      workflowStage: parsed.workflowStage,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return { taskId, updatedAt: 0 };
  }
}

/**
 * 디렉토리 내 모든 메타데이터를 일괄 로드. 파이프라인 뷰 등에서 N+1 요청을 피하기 위해 사용.
 * 디렉토리가 없거나 파일이 없으면 빈 배열.
 */
export async function listAllTaskMetadata(
  options: TaskMetadataOptions = {}
): Promise<TaskMetadata[]> {
  const dir = resolveDir(options);
  const results: TaskMetadata[] = [];
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = await readFile(join(dir, f), 'utf-8');
      const parsed = JSON.parse(raw) as Partial<TaskMetadata>;
      if (!parsed.taskId) continue;
      results.push({
        taskId: parsed.taskId,
        severity: parsed.severity,
        type: parsed.type,
        workflowName: parsed.workflowName,
        workflowStage: parsed.workflowStage,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
      });
    } catch {
      // 파싱 실패 스킵
    }
  }
  return results;
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
