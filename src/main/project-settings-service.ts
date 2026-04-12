import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { ProjectSettings } from '@shared/types';

const DEFAULT_FILE = join(homedir(), '.zm-agent-manager', 'project-settings.json');

const DEFAULT_SETTINGS: ProjectSettings = {
  currentProjectPath: null,
};

export interface ProjectSettingsOptions {
  settingsFile?: string;
}

export async function getProjectSettings(
  options: ProjectSettingsOptions = {}
): Promise<ProjectSettings> {
  const file = options.settingsFile ?? DEFAULT_FILE;
  try {
    const raw = await readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ProjectSettings>;
    return {
      currentProjectPath:
        typeof parsed.currentProjectPath === 'string' && parsed.currentProjectPath.length > 0
          ? parsed.currentProjectPath
          : null,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function setProjectSettings(
  settings: ProjectSettings,
  options: ProjectSettingsOptions = {}
): Promise<ProjectSettings> {
  const file = options.settingsFile ?? DEFAULT_FILE;
  await mkdir(dirname(file), { recursive: true });
  const sanitized: ProjectSettings = {
    currentProjectPath:
      typeof settings.currentProjectPath === 'string' && settings.currentProjectPath.length > 0
        ? settings.currentProjectPath
        : null,
  };
  await writeFile(file, JSON.stringify(sanitized, null, 2), 'utf-8');
  return sanitized;
}
