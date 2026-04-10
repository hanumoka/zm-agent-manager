import { watch, type FSWatcher } from 'chokidar';
import { Notification } from 'electron';
import { classifyDocImportance, type DocImportance } from '@shared/doc-importance';

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
  const fileName = filePath.split('/').pop() ?? filePath;

  try {
    if (Notification.isSupported()) {
      new Notification({
        title: `${label} 문서 ${eventType === 'change' ? '변경' : '추가'}`,
        body: fileName,
      }).show();
    }
  } catch {
    // Notification 사용 불가 — 무시
  }
}

/**
 * 문서 감시 시작. 프로젝트 루트의 docs/ + .claude/ 디렉토리를 감시.
 * main/index.ts의 app.whenReady()에서 호출.
 */
export function initDocWatcher(): void {
  const cwd = process.cwd();
  const watchPaths = [`${cwd}/docs/**/*.md`, `${cwd}/.claude/**/*.md`, `${cwd}/CLAUDE.md`];

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
