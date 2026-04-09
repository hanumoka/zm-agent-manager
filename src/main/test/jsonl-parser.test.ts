import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseJsonlFile } from '../jsonl-parser';

const TEST_DIR = join(tmpdir(), 'zm-jsonl-test');

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

function writeTestJsonl(filename: string, lines: unknown[]): string {
  const path = join(TEST_DIR, filename);
  writeFileSync(path, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return path;
}

describe('parseJsonlFile', () => {
  it('user/assistant 메시지를 파싱한다', async () => {
    const path = writeTestJsonl('basic.jsonl', [
      {
        type: 'user',
        uuid: 'u1',
        parentUuid: null,
        sessionId: 's1',
        timestamp: '2026-04-09T01:00:00Z',
        isSidechain: false,
        userType: 'external',
        entrypoint: 'cli',
        cwd: '/test',
        version: '2.0',
        gitBranch: 'main',
        message: { role: 'user', content: 'hello' },
      },
      {
        type: 'assistant',
        uuid: 'a1',
        parentUuid: 'u1',
        sessionId: 's1',
        timestamp: '2026-04-09T01:00:01Z',
        isSidechain: false,
        userType: 'external',
        entrypoint: 'cli',
        cwd: '/test',
        version: '2.0',
        gitBranch: 'main',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'hi' },
            { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/a.ts' } },
          ],
        },
      },
    ]);

    const result = await parseJsonlFile(path);
    expect(result.messageCount).toBe(2);
    expect(result.toolCallCount).toBe(1);
    expect(result.records).toHaveLength(2);
    expect(result.records[0].type).toBe('user');
    expect(result.records[1].type).toBe('assistant');
  });

  it('잘못된 JSON 라인을 스킵한다', async () => {
    const path = join(TEST_DIR, 'malformed.jsonl');
    writeFileSync(
      path,
      [
        '{"type":"user","uuid":"u1","parentUuid":null,"sessionId":"s1","timestamp":1000,"isSidechain":false,"userType":"e","entrypoint":"cli","cwd":"/","version":"2","gitBranch":"m","message":{"role":"user","content":"ok"}}',
        'NOT VALID JSON',
        '',
        '{"type":"assistant","uuid":"a1","parentUuid":"u1","sessionId":"s1","timestamp":2000,"isSidechain":false,"userType":"e","entrypoint":"cli","cwd":"/","version":"2","gitBranch":"m","message":{"role":"assistant","content":[{"type":"text","text":"hi"}]}}',
      ].join('\n')
    );

    const result = await parseJsonlFile(path);
    expect(result.messageCount).toBe(2);
    expect(result.records).toHaveLength(2);
  });

  it('빈 파일을 처리한다', async () => {
    const path = writeTestJsonl('empty.jsonl', []);
    writeFileSync(path, '');

    const result = await parseJsonlFile(path);
    expect(result.messageCount).toBe(0);
    expect(result.records).toHaveLength(0);
  });

  it('system 레코드를 파싱한다', async () => {
    const path = writeTestJsonl('system.jsonl', [
      {
        type: 'system',
        subtype: 'stop_hook_summary',
        uuid: 'sys1',
        parentUuid: 'a1',
        sessionId: 's1',
        timestamp: '2026-04-09T01:00:02Z',
        isSidechain: false,
        userType: 'external',
        entrypoint: 'cli',
        cwd: '/test',
        version: '2.0',
        gitBranch: 'main',
        hookCount: 1,
        hasOutput: true,
      },
    ]);

    const result = await parseJsonlFile(path);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].type).toBe('system');
  });

  it('lastActivity를 올바르게 계산한다', async () => {
    const path = writeTestJsonl('activity.jsonl', [
      {
        type: 'user',
        uuid: 'u1',
        parentUuid: null,
        sessionId: 's1',
        timestamp: '2026-04-09T01:00:00Z',
        isSidechain: false,
        userType: 'external',
        entrypoint: 'cli',
        cwd: '/test',
        version: '2.0',
        gitBranch: 'main',
        message: { role: 'user', content: 'first' },
      },
      {
        type: 'assistant',
        uuid: 'a1',
        parentUuid: 'u1',
        sessionId: 's1',
        timestamp: '2026-04-09T02:00:00Z',
        isSidechain: false,
        userType: 'external',
        entrypoint: 'cli',
        cwd: '/test',
        version: '2.0',
        gitBranch: 'main',
        message: { role: 'assistant', content: [{ type: 'text', text: 'last' }] },
      },
    ]);

    const result = await parseJsonlFile(path);
    expect(result.lastActivity).toBe(new Date('2026-04-09T02:00:00Z').getTime());
  });
});
