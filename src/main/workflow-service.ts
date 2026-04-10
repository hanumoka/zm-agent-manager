import { readdir, readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { WorkflowDefinition } from '@shared/types';

const DEFAULT_WORKFLOWS_DIR = join(homedir(), '.zm-agent-manager', 'workflows');

/** 기본 워크플로우 (앱 내장) */
const BUILTIN_WORKFLOWS: WorkflowDefinition[] = [
  {
    name: 'default',
    displayName: '기본 개발 워크플로우',
    stages: ['요구사항 수집', '설계', '구현', '테스트', '리뷰', '완료'],
    createdAt: 0,
  },
  {
    name: 'bugfix',
    displayName: '버그 수정 워크플로우',
    stages: ['재현', '원인 분석', '수정', '검증', '완료'],
    createdAt: 0,
  },
];

export interface WorkflowOptions {
  workflowsDir?: string;
}

function resolveDir(options: WorkflowOptions): string {
  return options.workflowsDir ?? DEFAULT_WORKFLOWS_DIR;
}

/** 모든 워크플로우 목록 (내장 + 사용자 정의) */
export async function listWorkflows(options: WorkflowOptions = {}): Promise<WorkflowDefinition[]> {
  const dir = resolveDir(options);
  const userWorkflows: WorkflowDefinition[] = [];

  try {
    const files = await readdir(dir);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const raw = await readFile(join(dir, f), 'utf-8');
        const parsed = JSON.parse(raw) as Partial<WorkflowDefinition>;
        if (parsed.name && Array.isArray(parsed.stages)) {
          userWorkflows.push({
            name: parsed.name,
            displayName: parsed.displayName ?? parsed.name,
            stages: parsed.stages.filter((s): s is string => typeof s === 'string'),
            createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : 0,
          });
        }
      } catch {
        // 파싱 실패 스킵
      }
    }
  } catch {
    // 디렉토리 없으면 내장만
  }

  // 내장 + 사용자 (내장 먼저, 사용자는 이름순)
  return [...BUILTIN_WORKFLOWS, ...userWorkflows.sort((a, b) => a.name.localeCompare(b.name))];
}

/** 워크플로우 저장 (생성/수정). 내장 워크플로우는 덮어쓸 수 없음. */
export async function saveWorkflow(
  workflow: WorkflowDefinition,
  options: WorkflowOptions = {}
): Promise<WorkflowDefinition> {
  if (BUILTIN_WORKFLOWS.some((b) => b.name === workflow.name)) {
    throw new Error(`내장 워크플로우 "${workflow.name}"는 수정할 수 없습니다`);
  }
  const dir = resolveDir(options);
  await mkdir(dir, { recursive: true });
  const toSave: WorkflowDefinition = {
    ...workflow,
    createdAt: workflow.createdAt || Date.now(),
  };
  await writeFile(join(dir, `${workflow.name}.json`), JSON.stringify(toSave, null, 2), 'utf-8');
  return toSave;
}

/** 사용자 정의 워크플로우 삭제. 내장은 삭제 불가. */
export async function deleteWorkflow(name: string, options: WorkflowOptions = {}): Promise<void> {
  if (BUILTIN_WORKFLOWS.some((b) => b.name === name)) {
    throw new Error(`내장 워크플로우 "${name}"는 삭제할 수 없습니다`);
  }
  const dir = resolveDir(options);
  try {
    await unlink(join(dir, `${name}.json`));
  } catch {
    // 파일 없어도 무시
  }
}
