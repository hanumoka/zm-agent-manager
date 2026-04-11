/**
 * E2E 통합 테스트: 실제 ~/.claude/ 데이터를 대상으로 핵심 기능 검증
 */
import { describe, it, expect } from 'vitest';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import { scanAllSessions } from '../session-scanner';
import { parseJsonlFile } from '../jsonl-parser';
import { encodeProjectPath } from '@shared/types';

const CLAUDE_DIR = join(homedir(), '.claude');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');
const ZM_PROJECT_PATH = process.cwd();
const ZM_PROJECT_DIR = join(PROJECTS_DIR, encodeProjectPath(ZM_PROJECT_PATH));

// ~/.claude/ 디렉토리가 없으면 테스트 스킵
const hasClaudeDir = existsSync(CLAUDE_DIR);
const describeIfClaude = hasClaudeDir ? describe : describe.skip;

describeIfClaude('E2E: scanAllSessions (실제 데이터)', () => {
  it('프로젝트 그룹을 반환한다', async () => {
    const groups = await scanAllSessions();

    expect(groups.length).toBeGreaterThanOrEqual(1);

    // zm-agent-manager 프로젝트가 존재하는지
    const zmGroup = groups.find((g) => g.projectName === 'zm-agent-manager');
    expect(zmGroup).toBeDefined();
  });

  it('zm-agent-manager 프로젝트에 세션이 있다', async () => {
    const groups = await scanAllSessions();
    const zmGroup = groups.find((g) => g.projectName === 'zm-agent-manager');

    expect(zmGroup).toBeDefined();
    expect(zmGroup!.sessions.length).toBeGreaterThanOrEqual(1);
  });

  it('세션 메타데이터가 올바른 필드를 갖는다', async () => {
    const groups = await scanAllSessions();
    const zmGroup = groups.find((g) => g.projectName === 'zm-agent-manager');
    const session = zmGroup!.sessions[0];

    expect(session.sessionId).toBeTruthy();
    expect(session.projectPath).toBeTruthy();
    expect(session.projectName).toBe('zm-agent-manager');
    expect(typeof session.lastActivity).toBe('number');
    expect(session.lastActivity).toBeGreaterThan(0);
    expect(typeof session.promptCount).toBe('number');
    expect(typeof session.isActive).toBe('boolean');
  });

  it('세션이 최근 활동 순으로 정렬되어 있다', async () => {
    const groups = await scanAllSessions();
    const zmGroup = groups.find((g) => g.projectName === 'zm-agent-manager');

    for (let i = 1; i < zmGroup!.sessions.length; i++) {
      expect(zmGroup!.sessions[i - 1].lastActivity).toBeGreaterThanOrEqual(
        zmGroup!.sessions[i].lastActivity
      );
    }
  });

  it('활성 세션이 감지된다', async () => {
    const groups = await scanAllSessions();
    const zmGroup = groups.find((g) => g.projectName === 'zm-agent-manager');
    const activeSessions = zmGroup!.sessions.filter((s) => s.isActive);

    // 현재 이 대화가 활성이므로 최소 1개
    expect(activeSessions.length).toBeGreaterThanOrEqual(1);
  });

  it('첫 메시지(display)가 존재하는 세션이 있다', async () => {
    const groups = await scanAllSessions();
    const zmGroup = groups.find((g) => g.projectName === 'zm-agent-manager');
    const withMessage = zmGroup!.sessions.filter((s) => s.firstMessage.length > 0);

    expect(withMessage.length).toBeGreaterThanOrEqual(1);
  });
});

describeIfClaude('E2E: parseJsonlFile (실제 데이터)', () => {
  // 가장 작은 파일로 테스트 (acadebe4, 4.5K)
  const smallSessionId = 'acadebe4-f8ef-487d-85f1-35e30a79b386';
  const smallJsonlPath = join(ZM_PROJECT_DIR, `${smallSessionId}.jsonl`);
  const hasSmallFile = existsSync(smallJsonlPath);

  it.skipIf(!hasSmallFile)('작은 JSONL 파일을 파싱한다', async () => {
    const result = await parseJsonlFile(smallJsonlPath);

    expect(result.sessionId).toBe(smallSessionId);
    expect(result.records.length).toBeGreaterThanOrEqual(1);
    expect(typeof result.messageCount).toBe('number');
    expect(typeof result.toolCallCount).toBe('number');
  });

  // 현재 세션 파일로 테스트 (b4464add, 2.3MB)
  const currentSessionId = 'b4464add-dd7c-4962-bb71-c2c6415d7d2b';
  const currentJsonlPath = join(ZM_PROJECT_DIR, `${currentSessionId}.jsonl`);
  const hasCurrentFile = existsSync(currentJsonlPath);

  it.skipIf(!hasCurrentFile)('현재 세션 JSONL을 파싱한다 (2.3MB)', async () => {
    const result = await parseJsonlFile(currentJsonlPath);

    expect(result.sessionId).toBe(currentSessionId);
    expect(result.records.length).toBeGreaterThan(100);
    expect(result.messageCount).toBeGreaterThan(50);
    expect(result.toolCallCount).toBeGreaterThan(10);
    expect(result.lastActivity).toBeGreaterThan(0);
  });

  it.skipIf(!hasCurrentFile)('레코드 타입 분포가 올바르다', async () => {
    const result = await parseJsonlFile(currentJsonlPath);

    const types = new Set(result.records.map((r) => r.type));
    expect(types.has('user')).toBe(true);
    expect(types.has('assistant')).toBe(true);
  });

  it.skipIf(!hasCurrentFile)('assistant 레코드에 content가 있다', async () => {
    const result = await parseJsonlFile(currentJsonlPath);
    const assistants = result.records.filter((r) => r.type === 'assistant');

    expect(assistants.length).toBeGreaterThan(0);

    for (const record of assistants.slice(0, 5)) {
      if (record.type === 'assistant') {
        expect(record.message).toBeDefined();
        expect(Array.isArray(record.message.content)).toBe(true);
      }
    }
  });

  it.skipIf(!hasCurrentFile)('tool_use 블록이 올바른 구조를 갖는다', async () => {
    const result = await parseJsonlFile(currentJsonlPath);
    const assistants = result.records.filter((r) => r.type === 'assistant');

    let foundToolUse = false;
    for (const record of assistants) {
      if (record.type === 'assistant') {
        for (const block of record.message.content) {
          if (block.type === 'tool_use') {
            expect(block.name).toBeTruthy();
            expect(block.id).toBeTruthy();
            expect(block.input).toBeDefined();
            foundToolUse = true;
            break;
          }
        }
        if (foundToolUse) break;
      }
    }
    expect(foundToolUse).toBe(true);
  });

  // 대용량 파일 테스트 (20b85cb8, 19MB)
  const largeSessionId = '20b85cb8-1918-4bbd-a438-90f717941496';
  const largeJsonlPath = join(ZM_PROJECT_DIR, `${largeSessionId}.jsonl`);
  const hasLargeFile = existsSync(largeJsonlPath);

  it.skipIf(!hasLargeFile)(
    '대용량 JSONL 파일을 파싱한다 (19MB)',
    async () => {
      const start = Date.now();
      const result = await parseJsonlFile(largeJsonlPath);
      const elapsed = Date.now() - start;

      expect(result.records.length).toBeGreaterThan(500);
      expect(result.messageCount).toBeGreaterThan(200);
      // 19MB 파일이 10초 이내에 파싱되어야 함
      expect(elapsed).toBeLessThan(10000);

      console.log(
        `[대용량] ${result.records.length}개 레코드, ${result.messageCount}개 메시지, ${result.toolCallCount}개 도구, ${elapsed}ms`
      );
    },
    15000
  );
});

describeIfClaude('E2E: encodeProjectPath 일관성', () => {
  it('scanAllSessions 결과의 projectPath를 인코딩하면 디렉토리명과 일치한다', async () => {
    const { encodeProjectPath } = await import('@shared/types');
    const groups = await scanAllSessions();

    for (const group of groups) {
      const encoded = encodeProjectPath(group.projectPath);
      // 실제 디렉토리가 존재하는지 확인
      expect(existsSync(join(PROJECTS_DIR, encoded))).toBe(true);
    }
  });
});
