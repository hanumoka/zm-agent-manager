import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { searchSessions } from '../search-service';

const ROOT = join(tmpdir(), 'zm-search-test');

interface FixtureRecord {
  type: 'user' | 'assistant';
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  message: { role: 'user' | 'assistant'; content: unknown };
}

function baseRecord(overrides: Partial<FixtureRecord> & { sessionId: string }): FixtureRecord {
  return {
    type: 'user',
    uuid: 'u-' + Math.random().toString(36).slice(2, 8),
    parentUuid: null,
    timestamp: '2026-04-09T01:00:00Z',
    message: { role: 'user', content: 'hello world' },
    ...overrides,
  } as FixtureRecord;
}

/** fixture: projectsDir 내 인코딩된 프로젝트 디렉토리 + sessionId.jsonl 작성 */
function writeFixtureProject(
  projectsDir: string,
  encodedDir: string,
  sessionId: string,
  records: FixtureRecord[]
): void {
  const dir = join(projectsDir, encodedDir);
  mkdirSync(dir, { recursive: true });
  const lines = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  writeFileSync(join(dir, `${sessionId}.jsonl`), lines);
}

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('searchSessions', () => {
  it('기본 텍스트 검색 — user 메시지 매칭', async () => {
    const projectsDir = join(ROOT, 'basic');
    mkdirSync(projectsDir, { recursive: true });
    writeFixtureProject(projectsDir, '-Users-foo-myproject', 's1', [
      baseRecord({
        sessionId: 's1',
        message: { role: 'user', content: '리액트 컴포넌트 작성' },
      }),
      baseRecord({
        sessionId: 's1',
        type: 'assistant',
        uuid: 'a1',
        message: { role: 'assistant', content: [{ type: 'text', text: '관련 없음' }] },
      }),
    ]);

    const res = await searchSessions('리액트', {}, { projectsDir, historyFile: '/nonexistent' });
    expect(res.results).toHaveLength(1);
    expect(res.results[0].recordType).toBe('user');
    expect(res.results[0].sessionId).toBe('s1');
    expect(res.results[0].matchText).toContain('리액트');
  });

  it('기간 필터 — dateFromMs/dateToMs inclusive 경계', async () => {
    const projectsDir = join(ROOT, 'date');
    mkdirSync(projectsDir, { recursive: true });
    writeFixtureProject(projectsDir, '-Users-foo-myproject', 's1', [
      baseRecord({ sessionId: 's1', timestamp: '2026-04-08T00:00:00Z' }),
      baseRecord({ sessionId: 's1', timestamp: '2026-04-09T12:00:00Z' }),
      baseRecord({ sessionId: 's1', timestamp: '2026-04-10T23:59:59Z' }),
    ]);

    // 4-09 하루만
    const dateFromMs = Date.UTC(2026, 3, 9, 0, 0, 0);
    const dateToMs = Date.UTC(2026, 3, 9, 23, 59, 59, 999);
    const res = await searchSessions(
      'hello',
      { dateFromMs, dateToMs },
      { projectsDir, historyFile: '/nonexistent' }
    );
    expect(res.results).toHaveLength(1);
    expect(res.results[0].timestamp).toBe('2026-04-09T12:00:00Z');
  });

  it('빈 timestamp 레코드 — 필터 활성 시 자동 제외 (의도된 동작)', async () => {
    const projectsDir = join(ROOT, 'empty-ts');
    mkdirSync(projectsDir, { recursive: true });
    writeFixtureProject(projectsDir, '-Users-foo-myproject', 's1', [
      baseRecord({ sessionId: 's1', timestamp: '' }),
      baseRecord({ sessionId: 's1', timestamp: '2026-04-09T01:00:00Z' }),
    ]);

    // 필터 없으면 둘 다 통과
    const noFilter = await searchSessions(
      'hello',
      {},
      { projectsDir, historyFile: '/nonexistent' }
    );
    expect(noFilter.results).toHaveLength(2);

    // dateFromMs 적용 시 빈 timestamp는 제외 (toEpochMs('') === 0 < dateFromMs)
    const filtered = await searchSessions(
      'hello',
      { dateFromMs: Date.UTC(2026, 3, 1) },
      { projectsDir, historyFile: '/nonexistent' }
    );
    expect(filtered.results).toHaveLength(1);
    expect(filtered.results[0].timestamp).toBe('2026-04-09T01:00:00Z');
  });

  it('projectName 필터 — 정확 일치만 통과', async () => {
    const projectsDir = join(ROOT, 'multi-project');
    mkdirSync(projectsDir, { recursive: true });
    writeFixtureProject(projectsDir, '-Users-foo-alpha', 's-alpha', [
      baseRecord({ sessionId: 's-alpha' }),
    ]);
    writeFixtureProject(projectsDir, '-Users-foo-beta', 's-beta', [
      baseRecord({ sessionId: 's-beta' }),
    ]);

    const res = await searchSessions(
      'hello',
      { projectName: 'alpha' },
      { projectsDir, historyFile: '/nonexistent' }
    );
    expect(res.results).toHaveLength(1);
    expect(res.results[0].sessionId).toBe('s-alpha');
    expect(res.results[0].projectName).toBe('alpha');
  });

  it('필터 + 쿼리 결합 — 둘 다 만족하는 레코드만', async () => {
    const projectsDir = join(ROOT, 'combo');
    mkdirSync(projectsDir, { recursive: true });
    writeFixtureProject(projectsDir, '-Users-foo-alpha', 's1', [
      // 매치 + 범위 내 → 통과
      baseRecord({
        sessionId: 's1',
        timestamp: '2026-04-09T10:00:00Z',
        message: { role: 'user', content: 'TypeScript 도입' },
      }),
      // 매치 + 범위 밖 → 제외
      baseRecord({
        sessionId: 's1',
        timestamp: '2026-04-15T10:00:00Z',
        message: { role: 'user', content: 'TypeScript 다른 작업' },
      }),
      // 범위 내 + 미매치 → 제외
      baseRecord({
        sessionId: 's1',
        timestamp: '2026-04-09T11:00:00Z',
        message: { role: 'user', content: 'JavaScript' },
      }),
    ]);

    const res = await searchSessions(
      'TypeScript',
      {
        dateFromMs: Date.UTC(2026, 3, 9, 0),
        dateToMs: Date.UTC(2026, 3, 9, 23, 59, 59, 999),
      },
      { projectsDir, historyFile: '/nonexistent' }
    );
    expect(res.results).toHaveLength(1);
    expect(res.results[0].matchText).toContain('도입');
  });

  it('MAX_RESULTS — 100건 cap', async () => {
    const projectsDir = join(ROOT, 'cap');
    mkdirSync(projectsDir, { recursive: true });
    const records: FixtureRecord[] = [];
    for (let i = 0; i < 150; i++) {
      records.push(
        baseRecord({
          sessionId: 's1',
          uuid: `u${i}`,
          message: { role: 'user', content: `match-${i}` },
        })
      );
    }
    writeFixtureProject(projectsDir, '-Users-foo-myproject', 's1', records);

    const res = await searchSessions('match', {}, { projectsDir, historyFile: '/nonexistent' });
    expect(res.results.length).toBeLessThanOrEqual(100);
    expect(res.totalMatches).toBeLessThanOrEqual(100);
  });
});
