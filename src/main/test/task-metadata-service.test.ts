import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { getTaskMetadata, setTaskMetadata } from '../task-metadata-service';
import type { TaskMetadata } from '@shared/types';

const ROOT = join(tmpdir(), 'zm-task-meta-test');

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('task-metadata-service', () => {
  it('파일 없으면 기본값 반환 (severity/type undefined, updatedAt 0)', async () => {
    const meta = await getTaskMetadata('s1:1', { metadataDir: ROOT });
    expect(meta.taskId).toBe('s1:1');
    expect(meta.severity).toBeUndefined();
    expect(meta.type).toBeUndefined();
    expect(meta.updatedAt).toBe(0);
  });

  it('save 후 get — 같은 값 반환', async () => {
    const input: TaskMetadata = {
      taskId: 's1:1',
      severity: 'blocking',
      type: 'fix',
      updatedAt: 0,
    };
    const saved = await setTaskMetadata(input, { metadataDir: ROOT });
    expect(saved.severity).toBe('blocking');
    expect(saved.type).toBe('fix');
    expect(saved.updatedAt).toBeGreaterThan(0);

    const loaded = await getTaskMetadata('s1:1', { metadataDir: ROOT });
    expect(loaded.severity).toBe('blocking');
    expect(loaded.type).toBe('fix');
  });

  it('taskId의 ":"는 "_"로 치환되어 파일명 안전', async () => {
    await setTaskMetadata(
      { taskId: 'session-abc:3', severity: 'important', updatedAt: 0 },
      { metadataDir: ROOT }
    );
    // 파일이 session-abc_3.json으로 생성되어야
    const raw = await readFile(join(ROOT, 'session-abc_3.json'), 'utf-8');
    const parsed = JSON.parse(raw) as TaskMetadata;
    expect(parsed.taskId).toBe('session-abc:3');
    expect(parsed.severity).toBe('important');
  });

  it('severity/type를 undefined로 설정하면 필드 없이 저장', async () => {
    await setTaskMetadata(
      { taskId: 's1:1', severity: undefined, type: undefined, updatedAt: 0 },
      { metadataDir: ROOT }
    );
    const loaded = await getTaskMetadata('s1:1', { metadataDir: ROOT });
    expect(loaded.severity).toBeUndefined();
    expect(loaded.type).toBeUndefined();
  });

  it('잘못된 JSON 파일은 기본값 반환', async () => {
    const { writeFile, mkdir } = await import('fs/promises');
    await mkdir(ROOT, { recursive: true });
    await writeFile(join(ROOT, 's1_1.json'), 'NOT JSON', 'utf-8');
    const meta = await getTaskMetadata('s1:1', { metadataDir: ROOT });
    expect(meta.taskId).toBe('s1:1');
    expect(meta.updatedAt).toBe(0);
  });
});
