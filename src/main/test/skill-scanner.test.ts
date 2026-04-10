import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { scanSkills, parseFrontmatter } from '../skill-scanner';

const ROOT = join(tmpdir(), 'zm-skill-test');

function writeSkill(rootDir: string, name: string, frontmatter: string, body = ''): void {
  const dir = join(rootDir, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), `---\n${frontmatter}\n---\n\n${body}`);
}

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('parseFrontmatter', () => {
  it('기본 key: value 파싱', () => {
    const result = parseFrontmatter('---\nname: foo\ndescription: bar\n---\nbody');
    expect(result).toEqual({ name: 'foo', description: 'bar' });
  });

  it('인용 부호 제거', () => {
    const result = parseFrontmatter('---\nname: "quoted"\ndescription: \'single\'\n---\n');
    expect(result).toEqual({ name: 'quoted', description: 'single' });
  });

  it('---로 시작하지 않으면 null', () => {
    expect(parseFrontmatter('no frontmatter here')).toBeNull();
  });

  it('종료 ---가 없으면 null', () => {
    expect(parseFrontmatter('---\nname: foo\nbody without close')).toBeNull();
  });

  it('allowed-tools 등 하이픈 키 지원', () => {
    const result = parseFrontmatter(
      '---\nallowed-tools: Read Grep\ndisable-model-invocation: true\n---\n'
    );
    expect(result?.['allowed-tools']).toBe('Read Grep');
    expect(result?.['disable-model-invocation']).toBe('true');
  });
});

describe('scanSkills', () => {
  it('빈 디렉토리는 빈 배열', async () => {
    const projectDir = join(ROOT, 'empty-project');
    const globalDir = join(ROOT, 'empty-global');
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(globalDir, { recursive: true });
    const skills = await scanSkills({ projectDir, globalDir });
    expect(skills).toEqual([]);
  });

  it('프로젝트 스킬을 파싱하여 scope=project로 표시', async () => {
    const projectDir = join(ROOT, 'project');
    const globalDir = join(ROOT, 'global');
    mkdirSync(globalDir, { recursive: true });
    writeSkill(
      projectDir,
      'my-skill',
      'name: my-skill\ndescription: 테스트 스킬\nallowed-tools: Read Grep Bash\nmodel: claude-opus-4-6'
    );

    const skills = await scanSkills({ projectDir, globalDir });
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('my-skill');
    expect(skills[0].scope).toBe('project');
    expect(skills[0].description).toBe('테스트 스킬');
    expect(skills[0].allowedTools).toEqual(['Read', 'Grep', 'Bash']);
    expect(skills[0].model).toBe('claude-opus-4-6');
    expect(skills[0].disableModelInvocation).toBe(false);
  });

  it('글로벌 스킬을 파싱하여 scope=global로 표시', async () => {
    const projectDir = join(ROOT, 'project');
    const globalDir = join(ROOT, 'global');
    mkdirSync(projectDir, { recursive: true });
    writeSkill(globalDir, 'global-skill', 'name: global-skill\ndescription: 글로벌');

    const skills = await scanSkills({ projectDir, globalDir });
    expect(skills).toHaveLength(1);
    expect(skills[0].scope).toBe('global');
    expect(skills[0].name).toBe('global-skill');
  });

  it('프로젝트 우선, 각 스코프 내 이름 알파벳순 정렬', async () => {
    const projectDir = join(ROOT, 'project');
    const globalDir = join(ROOT, 'global');
    writeSkill(projectDir, 'b-proj', 'name: b-proj\ndescription: B');
    writeSkill(projectDir, 'a-proj', 'name: a-proj\ndescription: A');
    writeSkill(globalDir, 'z-global', 'name: z-global\ndescription: Z');
    writeSkill(globalDir, 'a-global', 'name: a-global\ndescription: A');

    const skills = await scanSkills({ projectDir, globalDir });
    expect(skills.map((s) => s.name)).toEqual(['a-proj', 'b-proj', 'a-global', 'z-global']);
    expect(skills.slice(0, 2).every((s) => s.scope === 'project')).toBe(true);
    expect(skills.slice(2).every((s) => s.scope === 'global')).toBe(true);
  });

  it('disable-model-invocation: true 파싱', async () => {
    const projectDir = join(ROOT, 'project');
    writeSkill(
      projectDir,
      'silent-skill',
      'name: silent-skill\ndescription: 수동 전용\ndisable-model-invocation: true'
    );

    const skills = await scanSkills({ projectDir, globalDir: join(ROOT, 'g') });
    expect(skills[0].disableModelInvocation).toBe(true);
  });

  it('frontmatter 없는 SKILL.md는 스킵', async () => {
    const projectDir = join(ROOT, 'project');
    const dir = join(projectDir, 'bad-skill');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '# No frontmatter\n\njust markdown');

    const skills = await scanSkills({ projectDir, globalDir: join(ROOT, 'g') });
    expect(skills).toEqual([]);
  });

  it('SKILL.md가 없는 하위 디렉토리는 스킵', async () => {
    const projectDir = join(ROOT, 'project');
    mkdirSync(join(projectDir, 'empty-dir'), { recursive: true });
    writeSkill(projectDir, 'valid', 'name: valid\ndescription: OK');

    const skills = await scanSkills({ projectDir, globalDir: join(ROOT, 'g') });
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('valid');
  });

  it('sizeBytes / lastModified 포함', async () => {
    const projectDir = join(ROOT, 'project');
    writeSkill(projectDir, 'size-test', 'name: size-test\ndescription: x');

    const skills = await scanSkills({ projectDir, globalDir: join(ROOT, 'g') });
    expect(skills[0].sizeBytes).toBeGreaterThan(0);
    expect(skills[0].lastModified).toBeGreaterThan(0);
  });
});
