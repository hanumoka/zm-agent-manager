import { readdir, readFile, stat } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from 'os';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import type { HistoryEntry, ActiveSessionInfo, SessionMeta, ProjectGroup } from '@shared/types';

const CLAUDE_DIR = join(homedir(), '.claude');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');
const HISTORY_FILE = join(CLAUDE_DIR, 'history.jsonl');
const SESSIONS_DIR = join(CLAUDE_DIR, 'sessions');

/**
 * 프로젝트 인코딩 경로를 원래 경로로 디코딩
 * 예: -Users-hanumoka-projects-zm-agent-manager → /Users/hanumoka/projects/zm-agent-manager
 */
function decodeProjectPath(encoded: string): string {
  return encoded.replace(/^-/, '/').replace(/-/g, '/');
}

/**
 * 프로젝트 경로에서 이름 추출
 * 예: /Users/hanumoka/projects/zm-agent-manager → zm-agent-manager
 */
function extractProjectName(projectPath: string): string {
  return basename(projectPath);
}

/**
 * history.jsonl 파싱 — 세션별 첫 메시지와 타임스탬프 맵 생성
 */
async function parseHistoryFile(): Promise<Map<string, HistoryEntry[]>> {
  const sessionMap = new Map<string, HistoryEntry[]>();

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

  return sessionMap;
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
 * JSONL 파일에서 메시지 수와 마지막 활동 시간 추출 (경량 스캔)
 */
async function getSessionStats(
  jsonlPath: string
): Promise<{ messageCount: number; lastActivity: number }> {
  let messageCount = 0;
  let lastActivity = 0;

  let stream: ReturnType<typeof createReadStream> | null = null;
  let rl: ReturnType<typeof createInterface> | null = null;

  try {
    stream = createReadStream(jsonlPath, { encoding: 'utf-8' });
    rl = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line) as { type?: string; timestamp?: string | number };
        if (record.type === 'user' || record.type === 'assistant') {
          messageCount++;
        }
        if (record.timestamp) {
          const ts =
            typeof record.timestamp === 'string'
              ? new Date(record.timestamp).getTime()
              : record.timestamp;
          if (ts > lastActivity) lastActivity = ts;
        }
      } catch {
        // 잘못된 라인 스킵
      }
    }
  } catch {
    // 파일 읽기 실패
  } finally {
    rl?.close();
    stream?.destroy();
  }

  return { messageCount, lastActivity };
}

/**
 * 전체 세션 목록을 프로젝트별로 그룹핑하여 반환
 */
export async function scanAllSessions(): Promise<ProjectGroup[]> {
  const [historyMap, activeMap] = await Promise.all([parseHistoryFile(), getActiveSessions()]);

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

    const projectPath = decodeProjectPath(encodedDir);
    const projectName = extractProjectName(projectPath);
    const sessions: SessionMeta[] = [];

    // .jsonl 파일 스캔
    let files: string[];
    try {
      files = await readdir(projectDir);
    } catch {
      continue;
    }

    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl') && !f.includes('/'));

    for (const jsonlFile of jsonlFiles) {
      const sessionId = jsonlFile.replace('.jsonl', '');
      const jsonlPath = join(projectDir, jsonlFile);

      // history에서 첫 메시지 가져오기
      const historyEntries = historyMap.get(sessionId) ?? [];
      const firstMessage = historyEntries[0]?.display ?? '';

      // JSONL 파일에서 통계 추출
      const stats = await getSessionStats(jsonlPath);

      // history 타임스탬프가 없으면 JSONL 마지막 활동 사용
      const lastActivity =
        historyEntries.length > 0
          ? Math.max(...historyEntries.map((e) => e.timestamp))
          : stats.lastActivity;

      sessions.push({
        sessionId,
        projectPath,
        projectName,
        lastActivity,
        firstMessage,
        messageCount: stats.messageCount,
        isActive: activeMap.has(sessionId),
      });
    }

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
