import { readFile } from 'fs/promises';
import { join, basename } from 'path';
import type { WorkflowDefinition, ProjectWorkflowResult } from '@shared/types';
import { parseFrontmatter } from './skill-scanner';
import { getCurrentProjectPath } from './current-project';

/**
 * 프로젝트 루트의 `.claude/workflow.md`를 스캔하여 "공식 워크플로우"를 반환한다.
 *
 * **INBOX #10/#11**: 프로젝트당 정확히 1개 워크플로우. 해당 프로젝트에서 Claude Code가
 * 세션 시작 시 CLAUDE.md에서 참조하는 파일(또는 직접 로드)과 동일한 source of truth.
 *
 * **파일 형식** (`.claude/workflow.md`):
 * ```markdown
 * ---
 * name: default
 * displayName: 기본 개발 워크플로우
 * stages: 요구사항 설계 구현 테스트 리뷰 완료
 * ---
 * 여기부터는 자유 마크다운 (단계별 상세 설명 등)
 * ```
 *
 * **stages 형식**: 공백으로 구분된 단계 목록 (skill-scanner의 allowed-tools와 동일 규칙).
 * 쉼표 구분은 미지원 — YAML 파서가 경량이므로.
 */

export interface WorkflowScannerOptions {
  /** 프로젝트 `.claude/workflow.md` 파일 경로 (테스트용 직접 주입). */
  workflowFile?: string;
  /** 프로젝트 루트 경로. 주어지면 이 경로의 `.claude/workflow.md`를 스캔. 없으면 `getCurrentProjectPath()` 사용 */
  projectPath?: string;
}

/**
 * 프로젝트 루트의 workflow.md 1개를 파싱하여 워크플로우 + 매칭용 메타데이터 반환.
 *
 * 반환 `projectName`은 `basename(projectPath)`로, TaskInfo.projectName과 동일한 규칙이라
 * TaskBoard에서 태스크와 effective workflow를 매칭할 때 직접 사용 가능.
 *
 * `workflowFile`이 명시되지 않은 경우 `getCurrentProjectPath()` 기반으로 결정.
 * 파일 없거나 파싱 실패 시 `workflow`만 `null`이고 projectPath/projectName은 여전히 반환.
 */
export async function scanProjectWorkflow(
  options: WorkflowScannerOptions = {}
): Promise<ProjectWorkflowResult> {
  // 우선순위: workflowFile(테스트 주입) > projectPath(사용자 선택) > getCurrentProjectPath()(auto)
  const projectPath = options.projectPath
    ? options.projectPath
    : options.workflowFile
      ? // 테스트가 workflowFile을 직접 주입한 경우 projectPath는 의미 없음 (상위 폴더로 추정)
        join(options.workflowFile, '..', '..')
      : await getCurrentProjectPath();

  const filePath = options.workflowFile ?? join(projectPath, '.claude', 'workflow.md');
  const projectName = basename(projectPath);

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return { workflow: null, projectPath, projectName };
  }

  const frontmatter = parseFrontmatter(content);
  if (!frontmatter) return { workflow: null, projectPath, projectName };

  const name = frontmatter.name;
  if (!name) return { workflow: null, projectPath, projectName };

  const stagesRaw = frontmatter.stages ?? '';
  const stages = stagesRaw
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (stages.length === 0) return { workflow: null, projectPath, projectName };

  const workflow: WorkflowDefinition = {
    name,
    displayName: frontmatter.displayName ?? name,
    stages,
    createdAt: 0,
  };
  return { workflow, projectPath, projectName };
}
