import { watch, type FSWatcher } from 'chokidar';
import { readFile } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from 'os';
import { Notification } from 'electron';
import { getNotificationSettings } from './notification-settings-service';

/**
 * 세션 시작/종료 감시 (F16).
 * ~/.claude/sessions/{pid}.json 파일 생성(시작) / 삭제(종료) 감시.
 * notification-settings의 sessionLifecycle이 ON일 때만 알림 발송.
 */

const DEFAULT_SESSIONS_DIR = join(homedir(), '.claude', 'sessions');
let watcher: FSWatcher | null = null;

async function shouldNotify(): Promise<boolean> {
  try {
    const settings = await getNotificationSettings();
    return settings.sessionLifecycle;
  } catch {
    return false;
  }
}

function sendNotification(title: string, body: string): void {
  try {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  } catch {
    // 무시
  }
}

export function initSessionLifecycleWatcher(): void {
  const sessionsDir = DEFAULT_SESSIONS_DIR;

  watcher = watch(join(sessionsDir, '*.json'), {
    ignoreInitial: true,
    persistent: true,
  });

  watcher.on('add', async (path) => {
    if (!(await shouldNotify())) return;
    try {
      const raw = await readFile(path, 'utf-8');
      const info = JSON.parse(raw) as { sessionId?: string; cwd?: string; name?: string };
      const project = info.cwd?.split('/').pop() ?? '';
      const name = info.name ?? info.sessionId?.slice(0, 8) ?? basename(path);
      sendNotification('🟢 세션 시작', `${project} — ${name}`);
    } catch {
      sendNotification('🟢 세션 시작', basename(path));
    }
  });

  watcher.on('unlink', async (path) => {
    if (!(await shouldNotify())) return;
    const pid = basename(path).replace('.json', '');
    sendNotification('🔴 세션 종료', `PID ${pid}`);
  });
}

export async function stopSessionLifecycleWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
}
