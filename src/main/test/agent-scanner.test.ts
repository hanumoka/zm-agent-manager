import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { scanAgents } from '../agent-scanner';

const ROOT = join(tmpdir(), 'zm-agent-scanner-test');

function writeAgent(rootDir: string, name: string, frontmatter: string, body = ''): void {
  mkdirSync(rootDir, { recursive: true });
  writeFileSync(join(rootDir, `${name}.md`), `---\n${frontmatter}\n---\n\n${body}`);
}

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('scanAgents', () => {
  it('빈 디렉토리는 빈 배열', async () => {
    const projectDir = join(ROOT, 'proj');
    const globalDir = join(ROOT, 'global');
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(globalDir, { recursive: true });
    const agents = await scanAgents({ projectDir, globalDir });
    expect(agents).toEqual([]);
  });

  it('프로젝트 에이전트 파싱 — name/description/tools/model', async () => {
    const projectDir = join(ROOT, 'proj');
    writeAgent(
      projectDir,
      'my-agent',
      'name: my-agent\ndescription: 테스트 에이전트\ntools: Read, Glob, Grep\nmodel: sonnet'
    );

    const agents = await scanAgents({ projectDir, globalDir: join(ROOT, 'g') });
    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe('my-agent');
    expect(agents[0].scope).toBe('project');
    expect(agents[0].description).toBe('테스트 에이전트');
    expect(agents[0].tools).toEqual(['Read', 'Glob', 'Grep']);
    expect(agents[0].model).toBe('sonnet');
  });

  it('tools 쉼표+공백 혼합 구분 파싱', async () => {
    const projectDir = join(ROOT, 'proj');
    writeAgent(projectDir, 'mixed', 'name: mixed\ntools: Read, Glob Grep,WebSearch');

    const agents = await scanAgents({ projectDir, globalDir: join(ROOT, 'g') });
    expect(agents[0].tools).toEqual(['Read', 'Glob', 'Grep', 'WebSearch']);
  });

  it('글로벌 에이전트 → scope=global', async () => {
    const globalDir = join(ROOT, 'global');
    writeAgent(globalDir, 'g-agent', 'name: g-agent\ndescription: 글로벌');

    const agents = await scanAgents({ projectDir: join(ROOT, 'p'), globalDir });
    expect(agents).toHaveLength(1);
    expect(agents[0].scope).toBe('global');
  });

  it('프로젝트 우선 + 이름 알파벳순', async () => {
    const projectDir = join(ROOT, 'proj');
    const globalDir = join(ROOT, 'global');
    writeAgent(projectDir, 'b-proj', 'name: b-proj\ndescription: B');
    writeAgent(projectDir, 'a-proj', 'name: a-proj\ndescription: A');
    writeAgent(globalDir, 'z-glob', 'name: z-glob\ndescription: Z');

    const agents = await scanAgents({ projectDir, globalDir });
    expect(agents.map((a) => a.name)).toEqual(['a-proj', 'b-proj', 'z-glob']);
  });

  it('frontmatter 없는 MD 파일은 스킵', async () => {
    const projectDir = join(ROOT, 'proj');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'no-front.md'), '# No frontmatter');

    const agents = await scanAgents({ projectDir, globalDir: join(ROOT, 'g') });
    expect(agents).toEqual([]);
  });

  it('.md 아닌 파일은 무시', async () => {
    const projectDir = join(ROOT, 'proj');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'readme.txt'), 'text file');
    writeAgent(projectDir, 'valid', 'name: valid\ndescription: OK');

    const agents = await scanAgents({ projectDir, globalDir: join(ROOT, 'g') });
    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe('valid');
  });
});
