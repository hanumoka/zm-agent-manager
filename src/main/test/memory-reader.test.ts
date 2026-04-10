import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { readMemoryContent } from '../memory-reader';

const ROOT = join(tmpdir(), 'zm-memory-reader-test');

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('readMemoryContent', () => {
  it('MEMORY.md 정상 읽기 — content/lineCount/sizeBytes', async () => {
    const projectsDir = ROOT;
    const encodedDir = '-Users-foo-myproject';
    const memDir = join(projectsDir, encodedDir, 'memory');
    mkdirSync(memDir, { recursive: true });
    writeFileSync(join(memDir, 'MEMORY.md'), '# Memory\n\n- Item 1\n- Item 2\n');

    const result = await readMemoryContent(encodedDir, { projectsDir });
    expect(result.content).toBe('# Memory\n\n- Item 1\n- Item 2\n');
    expect(result.lineCount).toBe(5);
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.exceedsLimit).toBe(false);
    expect(result.projectName).toBe('myproject');
  });

  it('MEMORY.md 파일 없으면 content=null', async () => {
    const projectsDir = ROOT;
    const encodedDir = '-Users-foo-empty';
    mkdirSync(join(projectsDir, encodedDir), { recursive: true });

    const result = await readMemoryContent(encodedDir, { projectsDir });
    expect(result.content).toBeNull();
    expect(result.lineCount).toBe(0);
    expect(result.sizeBytes).toBe(0);
    expect(result.exceedsLimit).toBe(false);
  });

  it('200줄 초과 시 exceedsLimit=true', async () => {
    const projectsDir = ROOT;
    const encodedDir = '-Users-foo-big';
    const memDir = join(projectsDir, encodedDir, 'memory');
    mkdirSync(memDir, { recursive: true });
    const lines = Array.from({ length: 210 }, (_, i) => `Line ${i + 1}`).join('\n');
    writeFileSync(join(memDir, 'MEMORY.md'), lines);

    const result = await readMemoryContent(encodedDir, { projectsDir });
    expect(result.exceedsLimit).toBe(true);
    expect(result.lineCount).toBe(210);
  });

  it('200줄 이하는 exceedsLimit=false', async () => {
    const projectsDir = ROOT;
    const encodedDir = '-Users-foo-small';
    const memDir = join(projectsDir, encodedDir, 'memory');
    mkdirSync(memDir, { recursive: true });
    const lines = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`).join('\n');
    writeFileSync(join(memDir, 'MEMORY.md'), lines);

    const result = await readMemoryContent(encodedDir, { projectsDir });
    expect(result.exceedsLimit).toBe(false);
    expect(result.lineCount).toBe(50);
  });
});
