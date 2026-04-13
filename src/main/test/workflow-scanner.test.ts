import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { scanProjectWorkflow } from '../workflow-scanner';

describe('scanProjectWorkflow', () => {
  const testRoot = join(tmpdir(), `zm-workflow-scanner-test-${Date.now()}`);

  beforeAll(async () => {
    await mkdir(testRoot, { recursive: true });
  });

  afterAll(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('파일 없음 → workflow null', async () => {
    const result = await scanProjectWorkflow({
      workflowFile: join(testRoot, 'nonexistent', 'workflow.md'),
    });
    expect(result.workflow).toBeNull();
  });

  it('frontmatter 없음 → workflow null', async () => {
    const file = join(testRoot, 'no-frontmatter.md');
    await writeFile(file, '# 그냥 마크다운\n내용만 있음\n', 'utf-8');
    const result = await scanProjectWorkflow({ workflowFile: file });
    expect(result.workflow).toBeNull();
  });

  it('name 없음 → workflow null', async () => {
    const file = join(testRoot, 'no-name.md');
    await writeFile(
      file,
      '---\ndisplayName: 이름 없음\nstages: a b c\n---\n',
      'utf-8'
    );
    const result = await scanProjectWorkflow({ workflowFile: file });
    expect(result.workflow).toBeNull();
  });

  it('stages 없음 → workflow null', async () => {
    const file = join(testRoot, 'no-stages.md');
    await writeFile(file, '---\nname: empty\ndisplayName: 비었음\n---\n', 'utf-8');
    const result = await scanProjectWorkflow({ workflowFile: file });
    expect(result.workflow).toBeNull();
  });

  it('정상 파싱 — 최소 필드', async () => {
    const file = join(testRoot, 'minimal.md');
    await writeFile(file, '---\nname: my-flow\nstages: a b c\n---\n', 'utf-8');
    const result = await scanProjectWorkflow({ workflowFile: file });
    expect(result.workflow).toMatchObject({
      name: 'my-flow',
      displayName: 'my-flow',
      stages: ['a', 'b', 'c'],
      createdAt: 0,
    });
  });

  it('정상 파싱 — 전체 필드 + 본문', async () => {
    const file = join(testRoot, 'full.md');
    await writeFile(
      file,
      '---\nname: default\ndisplayName: 기본 개발 워크플로우\nstages: 요구사항 설계 구현 테스트 리뷰 완료\n---\n\n# 단계 설명\n\n## 요구사항\n...\n',
      'utf-8'
    );
    const result = await scanProjectWorkflow({ workflowFile: file });
    expect(result.workflow?.name).toBe('default');
    expect(result.workflow?.displayName).toBe('기본 개발 워크플로우');
    expect(result.workflow?.stages).toEqual([
      '요구사항',
      '설계',
      '구현',
      '테스트',
      '리뷰',
      '완료',
    ]);
  });

  it('stages 중복 공백 안전', async () => {
    const file = join(testRoot, 'whitespace.md');
    await writeFile(file, '---\nname: ws\nstages:   a   b  c   \n---\n', 'utf-8');
    const result = await scanProjectWorkflow({ workflowFile: file });
    expect(result.workflow?.stages).toEqual(['a', 'b', 'c']);
  });
});
