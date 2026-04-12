/**
 * 활동 모니터 — 60초 간격으로 3개 검사 순차 실행:
 * 1. 에이전트 stuck (활성 세션 JSONL mtime 15분 이상 경과)
 * 2. 대규모 미커밋 변경 (프로젝트별 50개 이상)
 * 3. 좀비 세션 파일 (json 파일은 있으나 pid 프로세스 사망)
 *
 * 각 검사는 독립적이며, NotificationSettings 토글에 따라 ON/OFF.
 * 알림은 `Notification` API + `addNotificationEntry`로 발송.
 * 중복 발송 방지: 프로젝트/세션별 마지막 알림 시각 저장.
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { Notification } from 'electron';
import type {
  ActiveSessionInfo,
  NotificationCategory,
  NotificationSettings,
} from '@shared/types';
import { encodeProjectPath } from '@shared/types';
import { parseHistoryFile } from './history-parser';
import { getNotificationSettings } from './notification-settings-service';
import { addNotificationEntry } from './notification-history-service';

const CLAUDE_DIR = join(homedir(), '.claude');
const SESSIONS_DIR = join(CLAUDE_DIR, 'sessions');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');

// ─── 상수 ───

const POLL_INTERVAL_MS = 60_000;
const STUCK_THRESHOLD_MS = 15 * 60_000; // 15분
const UNCOMMITTED_THRESHOLD = 50;
const UNCOMMITTED_DEBOUNCE_MS = 60 * 60_000; // 1시간

// ─── 상태 ───

let timer: NodeJS.Timeout | null = null;
/** 세션 ID별 stuck 알림 발송 시각(리셋: 해당 세션 mtime이 갱신되면) */
const stuckNotifiedAt = new Map<string, number>();
/** 프로젝트 경로별 uncommitted 알림 발송 시각 */
const uncommittedNotifiedAt = new Map<string, number>();
/** 좀비 세션 파일 이름별 알림 여부 (리셋: 파일 삭제 시) */
const zombieNotified = new Set<string>();

// ─── 입출력 타입 ───

export interface StuckCandidate {
  sessionId: string;
  filePath: string;
  mtime: number;
  /** 프로젝트 경로 (힌트용) */
  cwd: string;
}

export interface UncommittedResult {
  projectPath: string;
  changedCount: number;
}

export interface ZombieCandidate {
  sessionJsonFile: string;
  pid: number;
  sessionId: string;
}

// ─── 알림 발송 헬퍼 ───

function sendNotification(
  category: NotificationCategory,
  title: string,
  body: string
): void {
  try {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  } catch {
    // Notification 미지원 환경
  }
  void addNotificationEntry({ category, title, body }).catch(() => {});
}

// ─── 활성 세션 목록 로드 ───

async function loadActiveSessions(): Promise<ActiveSessionInfo[]> {
  const results: ActiveSessionInfo[] = [];
  let files: string[];
  try {
    files = await readdir(SESSIONS_DIR);
  } catch {
    return [];
  }
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = await readFile(join(SESSIONS_DIR, file), 'utf-8');
      const info = JSON.parse(content) as ActiveSessionInfo;
      results.push(info);
    } catch {
      // 파싱 실패 스킵
    }
  }
  return results;
}

// ─── C1: stuck 감지 ───

/**
 * 주어진 세션 목록에서 stuck 후보를 계산.
 * 순수 함수로 추출하여 테스트 용이.
 */
export function computeStuckCandidates(
  sessions: { sessionId: string; filePath: string; mtime: number; cwd: string }[],
  nowMs: number,
  thresholdMs: number = STUCK_THRESHOLD_MS
): StuckCandidate[] {
  return sessions.filter((s) => nowMs - s.mtime >= thresholdMs);
}

async function checkStuckAgents(nowMs: number): Promise<void> {
  const active = await loadActiveSessions();
  if (active.length === 0) return;

  const candidates: { sessionId: string; filePath: string; mtime: number; cwd: string }[] = [];
  for (const info of active) {
    const encoded = encodeProjectPath(info.cwd);
    const jsonlPath = join(PROJECTS_DIR, encoded, `${info.sessionId}.jsonl`);
    try {
      const s = await stat(jsonlPath);
      candidates.push({
        sessionId: info.sessionId,
        filePath: jsonlPath,
        mtime: s.mtimeMs,
        cwd: info.cwd,
      });
    } catch {
      // jsonl 파일 없으면 스킵
    }
  }

  const stuck = computeStuckCandidates(candidates, nowMs);

  for (const s of stuck) {
    const lastNotifiedMtime = stuckNotifiedAt.get(s.sessionId);
    // 해당 세션의 이전 알림 이후 mtime이 변하지 않았으면 중복 알림 방지
    if (lastNotifiedMtime !== undefined && lastNotifiedMtime === s.mtime) continue;
    stuckNotifiedAt.set(s.sessionId, s.mtime);
    const minutes = Math.round((nowMs - s.mtime) / 60_000);
    sendNotification(
      'agent-stuck',
      '🔴 에이전트 stuck',
      `${s.sessionId.slice(0, 8)} — ${minutes}분 무활동 (${s.cwd})`
    );
  }

  // mtime이 갱신된 세션은 플래그 리셋
  const activeIds = new Set(candidates.map((c) => c.sessionId));
  for (const [id, mtime] of stuckNotifiedAt.entries()) {
    if (!activeIds.has(id)) {
      stuckNotifiedAt.delete(id);
      continue;
    }
    const current = candidates.find((c) => c.sessionId === id);
    if (current && current.mtime !== mtime) {
      stuckNotifiedAt.delete(id);
    }
  }
}

// ─── C2: 미커밋 감지 ───

export function shouldNotifyUncommitted(
  projectPath: string,
  changedCount: number,
  lastNotifiedAt: Map<string, number>,
  nowMs: number,
  threshold: number = UNCOMMITTED_THRESHOLD,
  debounceMs: number = UNCOMMITTED_DEBOUNCE_MS
): boolean {
  if (changedCount < threshold) return false;
  const prev = lastNotifiedAt.get(projectPath);
  if (prev !== undefined && nowMs - prev < debounceMs) return false;
  return true;
}

async function checkUncommittedChanges(nowMs: number): Promise<void> {
  // 알려진 프로젝트 목록: history.jsonl의 projectPathMap
  let knownProjects: string[];
  try {
    const { projectPathMap } = await parseHistoryFile();
    knownProjects = Array.from(new Set(projectPathMap.values())).filter((p) => {
      return p && (p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p));
    });
  } catch {
    return;
  }

  if (knownProjects.length === 0) return;

  // simple-git 지연 로드
  let simpleGit: typeof import('simple-git').simpleGit;
  try {
    simpleGit = (await import('simple-git')).simpleGit;
  } catch {
    return;
  }

  for (const projectPath of knownProjects) {
    // 경로가 존재하고 git 저장소인지 확인
    try {
      await stat(join(projectPath, '.git'));
    } catch {
      continue;
    }
    let changedCount = 0;
    try {
      const git = simpleGit(projectPath);
      const status = await git.status();
      changedCount = status.files.length;
    } catch {
      continue;
    }
    if (shouldNotifyUncommitted(projectPath, changedCount, uncommittedNotifiedAt, nowMs)) {
      uncommittedNotifiedAt.set(projectPath, nowMs);
      sendNotification(
        'uncommitted-changes',
        '🟠 대규모 미커밋 변경',
        `${projectPath} — ${changedCount}개 파일 변경`
      );
    }
  }
}

// ─── C3: 좀비 감지 ───

export function computeZombieCandidates(
  sessionFiles: { file: string; pid: number; sessionId: string }[],
  livePids: Set<number>
): ZombieCandidate[] {
  return sessionFiles
    .filter((s) => !livePids.has(s.pid))
    .map((s) => ({
      sessionJsonFile: s.file,
      pid: s.pid,
      sessionId: s.sessionId,
    }));
}

async function checkZombieProcesses(): Promise<void> {
  const sessions: { file: string; pid: number; sessionId: string }[] = [];
  let files: string[];
  try {
    files = await readdir(SESSIONS_DIR);
  } catch {
    return;
  }
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = await readFile(join(SESSIONS_DIR, file), 'utf-8');
      const info = JSON.parse(content) as ActiveSessionInfo;
      if (typeof info.pid === 'number' && info.sessionId) {
        sessions.push({ file, pid: info.pid, sessionId: info.sessionId });
      }
    } catch {
      // 파싱 실패 스킵
    }
  }

  if (sessions.length === 0) {
    zombieNotified.clear();
    return;
  }

  // ps-list 지연 로드 (ESM)
  let psListFn: () => Promise<{ pid: number }[]>;
  try {
    psListFn = (await import('ps-list')).default;
  } catch {
    return;
  }

  let procs: { pid: number }[];
  try {
    procs = await psListFn();
  } catch {
    return;
  }
  const livePids = new Set(procs.map((p) => p.pid));

  const zombies = computeZombieCandidates(sessions, livePids);

  for (const z of zombies) {
    if (zombieNotified.has(z.sessionJsonFile)) continue;
    zombieNotified.add(z.sessionJsonFile);
    sendNotification(
      'zombie-process',
      '⚫ 좀비 세션 파일',
      `${z.sessionId.slice(0, 8)} — pid ${z.pid} 프로세스 종료됨`
    );
  }

  // 현재 존재하지 않는 세션 파일은 플래그 리셋
  const currentFiles = new Set(sessions.map((s) => s.file));
  for (const key of zombieNotified) {
    if (!currentFiles.has(key)) zombieNotified.delete(key);
  }
}

// ─── 메인 루프 ───

async function tick(): Promise<void> {
  let settings: NotificationSettings;
  try {
    settings = await getNotificationSettings();
  } catch {
    return;
  }
  const now = Date.now();
  const tasks: Promise<void>[] = [];
  if (settings.agentStuck) tasks.push(checkStuckAgents(now));
  if (settings.uncommittedChanges) tasks.push(checkUncommittedChanges(now));
  if (settings.zombieProcess) tasks.push(checkZombieProcesses());
  await Promise.all(
    tasks.map((t) =>
      t.catch((err) => {
        console.error({ context: 'activity-monitor.tick', error: err });
      })
    )
  );
}

export function initActivityMonitor(): void {
  if (timer) return;
  // 첫 체크는 잠깐 지연 (앱 시작 직후 과부하 방지)
  setTimeout(() => {
    void tick();
    timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
  }, 10_000);
}

export function stopActivityMonitor(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  stuckNotifiedAt.clear();
  uncommittedNotifiedAt.clear();
  zombieNotified.clear();
}
