import { Notification } from 'electron';
import { onNewRecordsInternal } from './session-watcher';
import { getNotificationSettings } from './notification-settings-service';
import { addNotificationEntry } from './notification-history-service';
import type { JsonlRecord, ContentBlock } from '@shared/types';

/**
 * 태스크 완료 트리거 (F16).
 * session-watcher의 내부 이벤트를 수신하여
 * TaskUpdate(status=completed) tool_use 감지 시 알림 발송.
 */

let unsubscribe: (() => void) | null = null;

function extractCompletedTasks(records: JsonlRecord[]): string[] {
  const completed: string[] = [];
  for (const record of records) {
    if (record.type !== 'assistant') continue;
    for (const block of record.message.content as ContentBlock[]) {
      if (block.type !== 'tool_use' || block.name !== 'TaskUpdate') continue;
      const input = block.input as Record<string, unknown>;
      if (input.status === 'completed') {
        const subject = (input.subject as string) ?? (input.taskId as string) ?? '';
        completed.push(subject);
      }
    }
  }
  return completed;
}

async function handleNewRecords(_sessionId: string, records: JsonlRecord[]): Promise<void> {
  const completed = extractCompletedTasks(records);
  if (completed.length === 0) return;

  const settings = await getNotificationSettings();
  if (!settings.taskComplete) return;

  for (const subject of completed) {
    const title = '태스크 완료';
    const body = subject || '(제목 없음)';
    try {
      if (Notification.isSupported()) {
        new Notification({ title, body }).show();
      }
    } catch {
      // 무시
    }
    void addNotificationEntry({ category: 'task-complete', title, body }).catch(() => {});
  }
}

export function initTaskCompleteWatcher(): void {
  unsubscribe = onNewRecordsInternal((sessionId, records) => {
    void handleNewRecords(sessionId, records);
  });
}

export function stopTaskCompleteWatcher(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
