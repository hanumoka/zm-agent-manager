import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import type { NotificationHistory, NotificationHistoryEntry, NotificationCategory } from '@shared/types';

const DEFAULT_FILE = join(homedir(), '.zm-agent-manager', 'notification-history.json');
const MAX_ENTRIES = 500;

export interface NotificationHistoryOptions {
  historyFile?: string;
}

async function loadHistory(file: string): Promise<NotificationHistory> {
  try {
    const raw = await readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<NotificationHistory>;
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    return { entries: [] };
  }
}

async function saveHistory(file: string, history: NotificationHistory): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(history, null, 2), 'utf-8');
}

export async function getNotificationHistory(
  options: NotificationHistoryOptions = {}
): Promise<NotificationHistory> {
  const file = options.historyFile ?? DEFAULT_FILE;
  return loadHistory(file);
}

export async function addNotificationEntry(
  entry: { category: NotificationCategory; title: string; body: string },
  options: NotificationHistoryOptions = {}
): Promise<NotificationHistoryEntry> {
  const file = options.historyFile ?? DEFAULT_FILE;
  const history = await loadHistory(file);

  const newEntry: NotificationHistoryEntry = {
    id: randomUUID(),
    category: entry.category,
    title: entry.title,
    body: entry.body,
    timestamp: Date.now(),
    read: false,
  };

  history.entries.unshift(newEntry);

  // FIFO: 최대 건수 초과 시 오래된 항목 삭제
  if (history.entries.length > MAX_ENTRIES) {
    history.entries = history.entries.slice(0, MAX_ENTRIES);
  }

  await saveHistory(file, history);
  return newEntry;
}

export async function markNotificationRead(
  id: string,
  options: NotificationHistoryOptions = {}
): Promise<NotificationHistoryEntry | null> {
  const file = options.historyFile ?? DEFAULT_FILE;
  const history = await loadHistory(file);

  const entry = history.entries.find((e) => e.id === id);
  if (!entry) return null;

  entry.read = true;
  await saveHistory(file, history);
  return entry;
}

export async function clearNotificationHistory(
  options: NotificationHistoryOptions = {}
): Promise<void> {
  const file = options.historyFile ?? DEFAULT_FILE;
  await saveHistory(file, { entries: [] });
}
