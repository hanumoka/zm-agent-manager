import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { NotificationSettings } from '@shared/types';

const DEFAULT_FILE = join(homedir(), '.zm-agent-manager', 'notification-settings.json');

const DEFAULT_SETTINGS: NotificationSettings = {
  budgetAlert: true,
  docChange: true,
  sessionLifecycle: false,
  taskComplete: false,
  agentStuck: false,
  uncommittedChanges: false,
  zombieProcess: false,
};

export interface NotificationSettingsOptions {
  settingsFile?: string;
}

export async function getNotificationSettings(
  options: NotificationSettingsOptions = {}
): Promise<NotificationSettings> {
  const file = options.settingsFile ?? DEFAULT_FILE;
  try {
    const raw = await readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
    return {
      budgetAlert:
        typeof parsed.budgetAlert === 'boolean' ? parsed.budgetAlert : DEFAULT_SETTINGS.budgetAlert,
      docChange:
        typeof parsed.docChange === 'boolean' ? parsed.docChange : DEFAULT_SETTINGS.docChange,
      sessionLifecycle:
        typeof parsed.sessionLifecycle === 'boolean'
          ? parsed.sessionLifecycle
          : DEFAULT_SETTINGS.sessionLifecycle,
      taskComplete:
        typeof parsed.taskComplete === 'boolean'
          ? parsed.taskComplete
          : DEFAULT_SETTINGS.taskComplete,
      agentStuck:
        typeof parsed.agentStuck === 'boolean'
          ? parsed.agentStuck
          : DEFAULT_SETTINGS.agentStuck,
      uncommittedChanges:
        typeof parsed.uncommittedChanges === 'boolean'
          ? parsed.uncommittedChanges
          : DEFAULT_SETTINGS.uncommittedChanges,
      zombieProcess:
        typeof parsed.zombieProcess === 'boolean'
          ? parsed.zombieProcess
          : DEFAULT_SETTINGS.zombieProcess,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function setNotificationSettings(
  settings: NotificationSettings,
  options: NotificationSettingsOptions = {}
): Promise<NotificationSettings> {
  const file = options.settingsFile ?? DEFAULT_FILE;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(settings, null, 2), 'utf-8');
  return settings;
}
