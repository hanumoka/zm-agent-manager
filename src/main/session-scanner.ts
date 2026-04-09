import { readdir, readFile, stat } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from 'os';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import type { HistoryEntry, ActiveSessionInfo, SessionMeta, ProjectGroup } from '@shared/types';
import { encodeProjectPath } from '@shared/types';

const CLAUDE_DIR = join(homedir(), '.claude');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');
const HISTORY_FILE = join(CLAUDE_DIR, 'history.jsonl');
const SESSIONS_DIR = join(CLAUDE_DIR, 'sessions');

interface HistoryParseResult {
  sessionMap: Map<string, HistoryEntry[]>;
  /** 인코딩된 디렉토리명 → 실제 프로젝트 경로 */
  projectPathMap: Map<string, string>;
}

/**
 * history.jsonl 파싱 — 세션별 메시지 맵 + 프로젝트 경로 맵 생성
 */
async function parseHistoryFile(): Promise<HistoryParseResult> {
  const sessionMap = new Map<string, HistoryEntry[]>();
  const projectPathMap = new Map<string, string>();

  let stream: ReturnType<typeof createReadStream> | null = null;
  let rl: ReturnType<typeof createInterface> | null = null;

  try {
    stream = createReadStream(HISTORY_FILE, { encoding: 'utf-8' });
    rl = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as HistoryEntry;
        const existing = sessionMap.get(entry.sessionId) ?? [];
        existing.push(entry);
        sessionMap.set(entry.sessionId, existing);

        // 프로젝트 경로 맵 갱신 (history.jsonl의 project 필드가 실제 경로)
        if (entry.project) {
          const encoded = encodeProjectPath(entry.project);
          projectPathMap.set(encoded, entry.project);
        }
      } catch {
        // 잘못된 JSON 라인 스킵
      }
    }
  } catch {
    // history.jsonl이 없으면 빈 맵 반환
  } finally {
    rl?.close();
    stream?.destroy();
  }

  return { sessionMap, projectPathMap };
}

/**
 * 활성 세션 목록 조회 — sessions/{pid}.json 스캔
 */
async function getActiveSessions(): Promise<Map<string, ActiveSessionInfo>> {
  const activeMap = new Map<string, ActiveSessionInfo>();

  try {
    const files = await readdir(SESSIONS_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await readFile(join(SESSIONS_DIR, file), 'utf-8');
        const info = JSON.parse(content) as ActiveSessionInfo;
        activeMap.set(info.sessionId, info);
      } catch {
        // 파싱 실패 스킵
      }
    }
  } catch {
    // sessions 디렉토리 없으면 빈 맵
  }

  return activeMap;
}

/**
 * JSONL 파일의 마지막 활동 시간을 파일 mtime으로 추출 (경량)
 */
async function getFileLastActivity(jsonlPath: string): Promise<number> {
  try {
    const s = await stat(jsonlPath);
    return s.mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * 전체 세션 목록을 프로젝트별로 그룹핑하여 반환
 */
export async function scanAllSessions(): Promise<ProjectGroup[]> {
  const [historyResult, activeMap] = await Promise.all([parseHistoryFile(), getActiveSessions()]);
  const { sessionMap: historyMap, projectPathMap } = historyResult;

  let projectDirs: string[];
  try {
    projectDirs = await readdir(PROJECTS_DIR);
  } catch {
    return [];
  }

  const groups: ProjectGroup[] = [];

  for (const encodedDir of projectDirs) {
    const projectDir = join(PROJECTS_DIR, encodedDir);

    // 디렉토리인지 확인
    try {
      const s = await stat(projectDir);
      if (!s.isDirectory()) continue;
    } catch {
      continue;
    }

    // history.jsonl에서 실제 프로젝트 경로 조회
    const projectPath = projectPathMap.get(encodedDir) ?? encodedDir;
    // fallback: 인코딩된 디렉토리명에서 마지막 세그먼트 추출 (앞 '-' 제거)
    const projectName = projectPathMap.has(encodedDir)
      ? basename(projectPath)
      : (encodedDir.split('-').pop() ?? encodedDir);
    const sessions: SessionMeta[] = [];

    // .jsonl 파일 스캔
    let files: string[];
    try {
      files = await readdir(projectDir);
    } catch {
      continue;
    }

    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl') && !f.includes('/'));

    // 파일 mtime 조회를 병렬로 수행
    const sessionEntries = await Promise.all(
      jsonlFiles.map(async (jsonlFile) => {
        const sessionId = jsonlFile.replace('.jsonl', '');
        const jsonlPath = join(projectDir, jsonlFile);

        const historyEntries = historyMap.get(sessionId) ?? [];
        const firstMessage = historyEntries[0]?.display ?? '';
        const fileMtime = await getFileLastActivity(jsonlPath);
        const historyLatest =
          historyEntries.length > 0 ? Math.max(...historyEntries.map((e) => e.timestamp)) : 0;
        const lastActivity = Math.max(historyLatest, fileMtime);

        return {
          sessionId,
          projectPath,
          projectName,
          lastActivity,
          firstMessage,
          messageCount: historyEntries.length,
          isActive: activeMap.has(sessionId),
        };
      })
    );

    sessions.push(...sessionEntries);

    // 최근 활동 순 정렬
    sessions.sort((a, b) => b.lastActivity - a.lastActivity);

    if (sessions.length > 0) {
      groups.push({ projectPath, projectName, sessions });
    }
  }

  // 프로젝트 내 최근 활동 순 정렬
  groups.sort((a, b) => {
    const aLatest = a.sessions[0]?.lastActivity ?? 0;
    const bLatest = b.sessions[0]?.lastActivity ?? 0;
    return bLatest - aLatest;
  });

  return groups;
}
