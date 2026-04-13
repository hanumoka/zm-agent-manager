import { readFile, readdir, writeFile, mkdir, unlink } from 'fs/promises';
import { join, basename } from 'path';
import { parse as parseYaml } from 'yaml';
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  ProjectWorkflowResult,
  ProjectWorkflowListResult,
} from '@shared/types';
import { getCurrentProjectPath } from './current-project';

/**
 * 프로젝트 워크플로우 스캐너 (INBOX #13 확장).
 *
 * **폴더 구조** (프로젝트당 다중 워크플로우 허용):
 *   `<project>/.claude/zm-agent-manager/workflows/{name}.md`
 *
 * **레거시 fallback**: 새 폴더에 파일이 없고 `<project>/.claude/workflow.md`가
 * 존재하면 해당 파일을 `default.md`로 자동 마이그레이션한다.
 *
 * **지원 스키마**:
 * 1. Statechart (신규): nodes/edges/start/end — loop 허용
 * 2. Linear (레거시): `stages: a b c` 단순 문자열 리스트
 */

const PROJECT_WORKFLOWS_SUBDIR = join('.claude', 'zm-agent-manager', 'workflows');
const LEGACY_WORKFLOW_FILE = join('.claude', 'workflow.md');

export function getProjectWorkflowsDir(projectPath: string): string {
  return join(projectPath, PROJECT_WORKFLOWS_SUBDIR);
}

export function getLegacyWorkflowPath(projectPath: string): string {
  return join(projectPath, LEGACY_WORKFLOW_FILE);
}

/** frontmatter 블록과 본문을 분리. 실패 시 null. */
function splitFrontmatter(content: string): { fm: string; body: string } | null {
  const trimmed = content.replace(/^\uFEFF/, '');
  const lines = trimmed.split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== '---') return null;
  const rest = lines.slice(1);
  const closeRel = rest.findIndex((l) => l.trim() === '---');
  if (closeRel === -1) return null;
  const fm = rest.slice(0, closeRel).join('\n');
  const body = rest.slice(closeRel + 1).join('\n');
  return { fm, body };
}

/**
 * 워크플로우 마크다운 내용을 WorkflowDefinition으로 파싱.
 * Statechart 형식 우선 시도, 실패 시 linear로 폴백. 둘 다 실패하면 null.
 */
export function parseWorkflowContent(
  content: string,
  filePath?: string
): WorkflowDefinition | null {
  const split = splitFrontmatter(content);
  if (!split) return null;
  let parsed: unknown;
  try {
    parsed = parseYaml(split.fm);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  const name = typeof obj.name === 'string' ? obj.name : null;
  if (!name) return null;
  const displayName = typeof obj.displayName === 'string' ? obj.displayName : name;

  const rawNodes = obj.nodes;
  const rawEdges = obj.edges;

  // Statechart 형식
  if (Array.isArray(rawNodes)) {
    const nodes: WorkflowNode[] = [];
    for (const n of rawNodes) {
      if (!n || typeof n !== 'object') continue;
      const nn = n as Record<string, unknown>;
      const id = typeof nn.id === 'string' ? nn.id : null;
      if (!id) continue;
      nodes.push({
        id,
        description: typeof nn.description === 'string' ? nn.description : undefined,
      });
    }
    const edges: WorkflowEdge[] = [];
    if (Array.isArray(rawEdges)) {
      for (const e of rawEdges) {
        if (!e || typeof e !== 'object') continue;
        const ee = e as Record<string, unknown>;
        const from = typeof ee.from === 'string' ? ee.from : null;
        const to = typeof ee.to === 'string' ? ee.to : null;
        if (!from || !to) continue;
        edges.push({
          from,
          to,
          label: typeof ee.label === 'string' ? ee.label : undefined,
        });
      }
    }
    const start =
      typeof obj.start === 'string' ? obj.start : nodes.length > 0 ? nodes[0].id : undefined;
    const endRaw = obj.end;
    const end: string[] = Array.isArray(endRaw)
      ? endRaw.filter((v): v is string => typeof v === 'string')
      : typeof endRaw === 'string'
        ? [endRaw]
        : [];
    const stages = deriveStagesFromGraph(nodes, edges, start);
    return {
      name,
      displayName,
      stages,
      createdAt: 0,
      start,
      end,
      nodes,
      edges,
      filePath,
      body: split.body,
    };
  }

  // Linear 레거시 형식: stages가 문자열 또는 배열
  const rawStages = obj.stages;
  let stages: string[] = [];
  if (typeof rawStages === 'string') {
    stages = rawStages
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } else if (Array.isArray(rawStages)) {
    stages = rawStages.filter((v): v is string => typeof v === 'string');
  }
  if (stages.length === 0) return null;
  return { name, displayName, stages, createdAt: 0, filePath, body: split.body };
}

/**
 * 그래프에서 BFS level order로 stages[]를 유도.
 * Loop가 있어도 한 번만 방문. 방문 못한 노드는 뒤에 append.
 */
export function deriveStagesFromGraph(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  start?: string
): string[] {
  if (nodes.length === 0) return [];
  const byId = new Set(nodes.map((n) => n.id));
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (byId.has(e.from) && byId.has(e.to)) {
      adj.get(e.from)?.push(e.to);
    }
  }
  const visited = new Set<string>();
  const order: string[] = [];
  const startId = start && byId.has(start) ? start : nodes[0].id;
  const queue: string[] = [startId];
  visited.add(startId);
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    order.push(cur);
    for (const next of adj.get(cur) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  for (const n of nodes) if (!visited.has(n.id)) order.push(n.id);
  return order;
}

async function readWorkflowFile(filePath: string): Promise<WorkflowDefinition | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return parseWorkflowContent(content, filePath);
  } catch {
    return null;
  }
}

/** 프로젝트 폴더 내 모든 워크플로우 목록 조회 + 필요 시 레거시 자동 마이그레이션. */
export async function listProjectWorkflows(projectPath: string): Promise<{
  workflows: WorkflowDefinition[];
  migrated: boolean;
}> {
  const dir = getProjectWorkflowsDir(projectPath);
  let migrated = false;

  const readDirWorkflows = async (): Promise<WorkflowDefinition[]> => {
    try {
      const files = await readdir(dir);
      const found: WorkflowDefinition[] = [];
      for (const f of files) {
        if (!f.endsWith('.md')) continue;
        const wf = await readWorkflowFile(join(dir, f));
        if (wf) found.push(wf);
      }
      return found;
    } catch {
      return [];
    }
  };

  let workflows = await readDirWorkflows();
  if (workflows.length === 0) {
    // 레거시 fallback: `.claude/workflow.md`가 있으면 새 폴더로 마이그레이션
    const legacy = await readWorkflowFile(getLegacyWorkflowPath(projectPath));
    if (legacy) {
      try {
        await saveProjectWorkflow(projectPath, legacy);
        migrated = true;
        workflows = await readDirWorkflows();
      } catch {
        // write 실패 시 레거시 원본만 반환 (읽기 전용 fallback)
        workflows = [legacy];
      }
    }
  }
  workflows.sort((a, b) => a.name.localeCompare(b.name));
  return { workflows, migrated };
}

/** 프로젝트 워크플로우 목록 IPC용 결과 반환. */
export async function scanProjectWorkflowList(
  projectPath?: string
): Promise<ProjectWorkflowListResult> {
  const resolved = projectPath ?? (await getCurrentProjectPath());
  const { workflows, migrated } = await listProjectWorkflows(resolved);
  return {
    workflows,
    projectPath: resolved,
    projectName: basename(resolved),
    migrated,
  };
}

export interface WorkflowScannerOptions {
  /** 테스트용 직접 주입 파일 경로 */
  workflowFile?: string;
  /** 프로젝트 루트 경로 */
  projectPath?: string;
  /** 특정 이름 선택. 미지정 시 default → 첫 번째 */
  workflowName?: string;
}

/**
 * 프로젝트 워크플로우 단일 조회 (기존 호환).
 * 우선순위: workflowName 매칭 → `default` → 첫 번째 → null
 */
export async function scanProjectWorkflow(
  options: WorkflowScannerOptions = {}
): Promise<ProjectWorkflowResult> {
  const projectPath = options.projectPath
    ? options.projectPath
    : options.workflowFile
      ? join(options.workflowFile, '..', '..')
      : await getCurrentProjectPath();
  const projectName = basename(projectPath);

  if (options.workflowFile) {
    const wf = await readWorkflowFile(options.workflowFile);
    return { workflow: wf, projectPath, projectName };
  }

  const { workflows } = await listProjectWorkflows(projectPath);
  if (workflows.length === 0) return { workflow: null, projectPath, projectName };
  const byName = options.workflowName
    ? workflows.find((w) => w.name === options.workflowName)
    : undefined;
  const chosen = byName ?? workflows.find((w) => w.name === 'default') ?? workflows[0];
  return { workflow: chosen, projectPath, projectName };
}

/**
 * 워크플로우를 `{name}.md`로 저장. body가 있으면 보존, 없으면 기본 템플릿.
 */
export async function saveProjectWorkflow(
  projectPath: string,
  workflow: WorkflowDefinition
): Promise<WorkflowDefinition> {
  const dir = getProjectWorkflowsDir(projectPath);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${workflow.name}.md`);
  const md = serializeWorkflow(workflow);
  await writeFile(filePath, md, 'utf-8');
  return { ...workflow, filePath };
}

/** 프로젝트 워크플로우 삭제 */
export async function deleteProjectWorkflow(
  projectPath: string,
  name: string
): Promise<void> {
  const filePath = join(getProjectWorkflowsDir(projectPath), `${name}.md`);
  try {
    await unlink(filePath);
  } catch {
    // 파일 없어도 무시
  }
}

/** WorkflowDefinition → YAML frontmatter + markdown body */
export function serializeWorkflow(wf: WorkflowDefinition): string {
  const lines: string[] = ['---'];
  lines.push(`name: ${wf.name}`);
  lines.push(`displayName: ${yamlString(wf.displayName)}`);
  const hasGraph = Array.isArray(wf.nodes) && wf.nodes.length > 0;
  if (hasGraph) {
    if (wf.start) lines.push(`start: ${wf.start}`);
    if (wf.end && wf.end.length > 0) {
      lines.push('end:');
      for (const e of wf.end) lines.push(`  - ${e}`);
    }
    lines.push('nodes:');
    for (const n of wf.nodes ?? []) {
      lines.push(`  - id: ${n.id}`);
      if (n.description) {
        lines.push(`    description: ${yamlString(n.description)}`);
      }
    }
    lines.push('edges:');
    for (const e of wf.edges ?? []) {
      lines.push(`  - from: ${e.from}`);
      lines.push(`    to: ${e.to}`);
      if (e.label) lines.push(`    label: ${yamlString(e.label)}`);
    }
  } else {
    lines.push(`stages: ${wf.stages.join(' ')}`);
  }
  lines.push('---');
  lines.push('');
  if (wf.body && wf.body.trim().length > 0) {
    lines.push(wf.body.replace(/^\n+/, ''));
  }
  return lines.join('\n') + (lines[lines.length - 1] === '' ? '' : '\n');
}

function yamlString(value: string): string {
  // 특수문자가 포함되면 quote, 아니면 평문
  if (/[:#\n"']/g.test(value)) return JSON.stringify(value);
  return value;
}
