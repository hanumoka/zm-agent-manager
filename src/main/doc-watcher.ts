import { watch, type FSWatcher } from 'chokidar';
import { basename, join } from 'path';
import { Notification } from 'electron';
import { classifyDocImportance, type DocImportance } from '@shared/doc-importance';
import { addNotificationEntry } from './notification-history-service';
import { getCurrentProjectPath } from './current-project';

/**
 * 문서 변경 감시 (F15).
 * docs/ + .claude/ 디렉토리를 chokidar로 감시하여
 * 중요도 blocking/important 문서가 변경되면 데스크톱 알림을 발송한다.
 *
 * suggestion 중요도는 알림 생략 (대시보드에서만 표시).
 * 동일 파일 30초 내 재알림 방지 (debounce).
 */

let watcher: FSWatcher | null = null;
const recentNotifications = new Map<string, number>();
const DEBOUNCE_MS = 30_000; // 30초

const IMPORTANCE_LABELS: Record<DocImportance, string> = {
  blocking: '🔴 Blocking',
  important: '🟠 Important',
  suggestion: '⚪',
};

function shouldNotify(filePath: string): boolean {
  const importance = classifyDocImportance(filePath);
  if (importance === 'suggestion') return false;

  const now = Date.now();
  const lastNotified = recentNotifications.get(filePath);
  if (lastNotified && now - lastNotified < DEBOUNCE_MS) return false;

  recentNotifications.set(filePath, now);
  return true;
}

function sendDocNotification(filePath: string, eventType: string): void {
  const importance = classifyDocImportance(filePath);
  const label = IMPORTANCE_LABELS[importance];
  const fileName = basename(filePath);
  const title = `${label} 문서 ${eventType === 'change' ? '변경' : '추가'}`;

  try {
    if (Notification.isSupported()) {
      new Notification({ title, body: fileName }).show();
    }
  } catch {
    // Notification 사용 불가 — 무시
  }
  void addNotificationEntry({ category: 'doc-change', title, body: fileName }).catch(() => {});
}

/**
 * 문서 감시 시작. 최근 활동 세션의 projectPath 기준으로 docs/ + .claude/ 디렉토리를 감시.
 * main/index.ts의 app.whenReady()에서 호출 (await 불필요 — fire-and-forget).
 *
 * 설치된 exe 환경에서는 `process.cwd()`가 설치 경로가 되어 잘못된 디렉토리를
 * 감시하는 이슈를 회피하기 위해 `getCurrentProjectPath()`를 사용한다.
 */
export async function initDocWatcher(): Promise<void> {
  const projectRoot = await getCurrentProjectPath();
  const watchPaths = [
    join(projectRoot, 'docs', '**', '*.md'),
    join(projectRoot, '.claude', '**', '*.md'),
    join(projectRoot, 'CLAUDE.md'),
  ];

  watcher = watch(watchPaths, {
    ignoreInitial: true,
    persistent: true,
    // 파일 시스템 이벤트 안정화 대기
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  });

  watcher.on('change', (path) => {
    if (shouldNotify(path)) {
      sendDocNotification(path, 'change');
    }
  });

  watcher.on('add', (path) => {
    if (shouldNotify(path)) {
      sendDocNotification(path, 'add');
    }
  });
}

/** 문서 감시 종료. app.on('will-quit')에서 호출. */
export async function stopDocWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
  recentNotifications.clear();
}
