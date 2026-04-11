import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';

const DEFAULT_FILE = join(homedir(), '.zm-agent-manager', 'sidebar-settings.json');

export interface SidebarItemConfig {
  /** NAV_ITEMS의 path 값 (식별자) */
  path: string;
  /** 표시 여부 */
  visible: boolean;
  /** 표시 순서 (0부터) */
  order: number;
}

export interface SidebarSettings {
  items: SidebarItemConfig[];
}

export interface SidebarSettingsOptions {
  settingsFile?: string;
}

export async function getSidebarSettings(
  options: SidebarSettingsOptions = {}
): Promise<SidebarSettings> {
  const file = options.settingsFile ?? DEFAULT_FILE;
  try {
    const raw = await readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SidebarSettings>;
    if (Array.isArray(parsed.items)) {
      return { items: parsed.items };
    }
    return { items: [] };
  } catch {
    return { items: [] };
  }
}

export async function setSidebarSettings(
  settings: SidebarSettings,
  options: SidebarSettingsOptions = {}
): Promise<SidebarSettings> {
  const file = options.settingsFile ?? DEFAULT_FILE;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(settings, null, 2), 'utf-8');
  return settings;
}
