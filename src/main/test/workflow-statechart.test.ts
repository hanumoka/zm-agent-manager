import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm, readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  parseWorkflowContent,
  deriveStagesFromGraph,
  listProjectWorkflows,
  saveProjectWorkflow,
  deleteProjectWorkflow,
  scanProjectWorkflow,
  serializeWorkflow,
} from '../workflow-scanner';
import { validateWorkflow } from '../workflow-validator';
import type { WorkflowDefinition } from '@shared/types';

const STATECHART_MD = `---
name: default
displayName: 상태차트 예시
start: 요구사항
end:
  - 배포
nodes:
  - id: 요구사항
    description: 검증 프로토콜
  - id: 구현
  - id: 검증
  - id: 문서갱신
  - id: 배포
edges:
  - from: 요구사항
    to: 구현
  - from: 구현
    to: 검증
  - from: 검증
    to: 구현
    label: 실패
  - from: 검증
    to: 문서갱신
    label: 통과
  - from: 문서갱신
    to: 배포
---

# 본문
`;

describe('parseWorkflowContent — statechart', () => {
  it('nodes/edges/start/end 파싱', () => {
    const wf = parseWorkflowContent(STATECHART_MD);
    expect(wf).not.toBeNull();
    expect(wf?.name).toBe('default');
    expect(wf?.displayName).toBe('상태차트 예시');
    expect(wf?.start).toBe('요구사항');
    expect(wf?.end).toEqual(['배포']);
    expect(wf?.nodes?.map((n) => n.id)).toEqual([
      '요구사항',
      '구현',
      '검증',
      '문서갱신',
      '배포',
    ]);
    expect(wf?.edges).toHaveLength(5);
    // BFS level order로 stages가 derive되어야 함
    expect(wf?.stages[0]).toBe('요구사항');
    expect(wf?.stages).toContain('배포');
  });

  it('loop edge도 그대로 보존', () => {
    const wf = parseWorkflowContent(STATECHART_MD);
    const loop = wf?.edges?.find((e) => e.from === '검증' && e.to === '구현');
    expect(loop?.label).toBe('실패');
  });
});

describe('deriveStagesFromGraph', () => {
  it('linear chain', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ];
    expect(deriveStagesFromGraph(nodes, edges, 'a')).toEqual(['a', 'b', 'c']);
  });

  it('loop은 한 번만 방문', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' },
      { from: 'b', to: 'c' },
    ];
    const order = deriveStagesFromGraph(nodes, edges, 'a');
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('고립 노드는 뒤에 append', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'island' }];
    const edges = [{ from: 'a', to: 'b' }];
    const order = deriveStagesFromGraph(nodes, edges, 'a');
    expect(order).toEqual(['a', 'b', 'island']);
  });
});

describe('validateWorkflow', () => {
  const buildGraph = (overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition => ({
    name: 'test',
    displayName: 'test',
    stages: [],
    createdAt: 0,
    start: 'a',
    end: ['c'],
    nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ],
    ...overrides,
  });

  it('유효한 linear chain', () => {
    const r = validateWorkflow(buildGraph());
    expect(r.valid).toBe(true);
  });

  it('유효한 loop (검증 → 구현 실패 분기)', () => {
    const wf = parseWorkflowContent(STATECHART_MD)!;
    const r = validateWorkflow(wf);
    expect(r.valid).toBe(true);
  });

  it('name 없으면 실패', () => {
    const r = validateWorkflow(buildGraph({ name: '' }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.rule === 'name-required')).toBe(true);
  });

  it('start 없으면 실패', () => {
    const r = validateWorkflow(buildGraph({ start: undefined }));
    expect(r.errors.some((e) => e.rule === 'start-required')).toBe(true);
  });

  it('start가 nodes에 없으면 실패', () => {
    const r = validateWorkflow(buildGraph({ start: 'ghost' }));
    expect(r.errors.some((e) => e.rule === 'start-exists')).toBe(true);
  });

  it('end 비어 있으면 실패', () => {
    const r = validateWorkflow(buildGraph({ end: [] }));
    expect(r.errors.some((e) => e.rule === 'end-required')).toBe(true);
  });

  it('노드 id 중복 감지', () => {
    const r = validateWorkflow(
      buildGraph({
        nodes: [{ id: 'a' }, { id: 'a' }, { id: 'c' }],
      })
    );
    expect(r.errors.some((e) => e.rule === 'unique-ids')).toBe(true);
  });

  it('edge가 존재하지 않는 노드 참조', () => {
    const r = validateWorkflow(
      buildGraph({
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'ghost' },
        ],
      })
    );
    expect(r.errors.some((e) => e.rule === 'edge-to')).toBe(true);
  });

  it('도달 불가 노드 감지', () => {
    const r = validateWorkflow(
      buildGraph({
        nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'orphan' }],
      })
    );
    expect(r.errors.some((e) => e.rule === 'unreachable')).toBe(true);
  });

  it('데드락 노드 감지 (end 도달 불가)', () => {
    const r = validateWorkflow(
      buildGraph({
        nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'trap' }],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
          { from: 'a', to: 'trap' },
        ],
      })
    );
    expect(r.errors.some((e) => e.rule === 'dead-end')).toBe(true);
  });

  it('end 노드의 outgoing edge 금지', () => {
    const r = validateWorkflow(
      buildGraph({
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
          { from: 'c', to: 'a' },
        ],
      })
    );
    expect(r.errors.some((e) => e.rule === 'end-no-outgoing')).toBe(true);
  });
});

describe('listProjectWorkflows + 마이그레이션 + 저장/삭제', () => {
  const testRoot = join(tmpdir(), `zm-workflow-folder-${Date.now()}`);

  beforeAll(async () => {
    await mkdir(testRoot, { recursive: true });
  });

  afterAll(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('폴더 없음 + 레거시 없음 → 빈 목록', async () => {
    const proj = join(testRoot, 'empty');
    await mkdir(proj, { recursive: true });
    const { workflows, migrated } = await listProjectWorkflows(proj);
    expect(workflows).toHaveLength(0);
    expect(migrated).toBe(false);
  });

  it('레거시 `.claude/workflow.md` 자동 마이그레이션', async () => {
    const proj = join(testRoot, 'legacy');
    await mkdir(join(proj, '.claude'), { recursive: true });
    await writeFile(
      join(proj, '.claude', 'workflow.md'),
      '---\nname: default\ndisplayName: 레거시\nstages: a b c\n---\n',
      'utf-8'
    );
    const { workflows, migrated } = await listProjectWorkflows(proj);
    expect(migrated).toBe(true);
    expect(workflows).toHaveLength(1);
    expect(workflows[0].name).toBe('default');
    // 새 폴더에 파일이 생성되었어야 함
    const files = await readdir(
      join(proj, '.claude', 'zm-agent-manager', 'workflows')
    );
    expect(files).toContain('default.md');
  });

  it('두 번째 호출은 마이그레이션 skip', async () => {
    const proj = join(testRoot, 'legacy2');
    await mkdir(join(proj, '.claude'), { recursive: true });
    await writeFile(
      join(proj, '.claude', 'workflow.md'),
      '---\nname: default\nstages: x y\n---\n',
      'utf-8'
    );
    await listProjectWorkflows(proj);
    const second = await listProjectWorkflows(proj);
    expect(second.migrated).toBe(false);
    expect(second.workflows).toHaveLength(1);
  });

  it('saveProjectWorkflow로 statechart 저장 + 재파싱', async () => {
    const proj = join(testRoot, 'save');
    const wf = parseWorkflowContent(STATECHART_MD)!;
    await saveProjectWorkflow(proj, wf);
    const { workflows } = await listProjectWorkflows(proj);
    expect(workflows).toHaveLength(1);
    expect(workflows[0].nodes).toHaveLength(5);
    expect(workflows[0].edges).toHaveLength(5);
    expect(workflows[0].start).toBe('요구사항');
  });

  it('deleteProjectWorkflow로 삭제', async () => {
    const proj = join(testRoot, 'del');
    const wf = parseWorkflowContent(STATECHART_MD)!;
    await saveProjectWorkflow(proj, wf);
    await deleteProjectWorkflow(proj, 'default');
    const { workflows } = await listProjectWorkflows(proj);
    expect(workflows).toHaveLength(0);
  });

  it('scanProjectWorkflow는 default를 우선 선택', async () => {
    const proj = join(testRoot, 'multi');
    const base = parseWorkflowContent(STATECHART_MD)!;
    await saveProjectWorkflow(proj, { ...base, name: 'custom' });
    await saveProjectWorkflow(proj, { ...base, name: 'default' });
    const result = await scanProjectWorkflow({ projectPath: proj });
    expect(result.workflow?.name).toBe('default');
  });

  it('serializeWorkflow round-trip (linear)', () => {
    const wf: WorkflowDefinition = {
      name: 'lin',
      displayName: 'Linear',
      stages: ['a', 'b', 'c'],
      createdAt: 0,
    };
    const md = serializeWorkflow(wf);
    expect(md).toContain('stages: a b c');
    const re = parseWorkflowContent(md);
    expect(re?.stages).toEqual(['a', 'b', 'c']);
  });

  it('serializeWorkflow — statechart에는 body도 보존', async () => {
    const proj = join(testRoot, 'body');
    const wf = parseWorkflowContent(STATECHART_MD)!;
    await saveProjectWorkflow(proj, wf);
    const file = join(proj, '.claude', 'zm-agent-manager', 'workflows', 'default.md');
    const content = await readFile(file, 'utf-8');
    expect(content).toContain('# 본문');
  });
});
