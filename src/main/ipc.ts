import { join } from 'path';
import { homedir } from 'os';
import { ipcMain } from 'electron';
import { IPC_CHANNELS, type SearchFilters, type BudgetSettings } from '@shared/types';
import { scanAllSessions } from './session-scanner';
import { parseJsonlFile } from './jsonl-parser';
import { watchSession, unwatchSession } from './session-watcher';
import { scanAllTasks } from './task-scanner';
import { scanCostSummary } from './cost-scanner';
import { scanSessionSubagents } from './subagent-scanner';
import { scanProjectDocs } from './doc-scanner';
import { searchSessions } from './search-service';
import { loadBudgetSettings, saveBudgetSettings, evaluateBudgetAlerts } from './budget-service';

const CLAUDE_DIR = join(homedir(), '.claude');

/**
 * IPC 핸들러 등록 — 렌더러에서 호출 가능한 API
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GET_SESSIONS, async () => {
    return scanAllSessions();
  });

  ipcMain.handle(
    IPC_CHANNELS.PARSE_SESSION,
    async (_event, projectEncoded: string, sessionId: string) => {
      const jsonlPath = join(CLAUDE_DIR, 'projects', projectEncoded, `${sessionId}.jsonl`);
      return parseJsonlFile(jsonlPath);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.WATCH_SESSION,
    async (_event, sessionId: string, projectEncoded: string) => {
      watchSession(sessionId, projectEncoded);
    }
  );

  ipcMain.handle(IPC_CHANNELS.UNWATCH_SESSION, async (_event, sessionId: string) => {
    unwatchSession(sessionId);
  });

  ipcMain.handle(IPC_CHANNELS.GET_ALL_TASKS, async () => {
    const tasks = await scanAllTasks();
    return { tasks };
  });

  ipcMain.handle(IPC_CHANNELS.GET_COST_SUMMARY, async () => {
    const summary = await scanCostSummary();
    // 비용 갱신 시 예산 임계 평가 (실패해도 비용 응답에 영향 없음)
    void evaluateBudgetAlerts(summary).catch(() => {});
    return summary;
  });

  ipcMain.handle(
    IPC_CHANNELS.GET_SESSION_SUBAGENTS,
    async (_event, projectEncoded: string, sessionId: string) => {
      return scanSessionSubagents(projectEncoded, sessionId);
    }
  );

  ipcMain.handle(IPC_CHANNELS.GET_PROJECT_DOCS, async (_event, projectPath: string) => {
    return scanProjectDocs(projectPath);
  });

  ipcMain.handle(
    IPC_CHANNELS.SEARCH_SESSIONS,
    async (_event, query: string, filters?: SearchFilters) => {
      return searchSessions(query, filters);
    }
  );

  ipcMain.handle(IPC_CHANNELS.GET_BUDGET_SETTINGS, async () => {
    return loadBudgetSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SET_BUDGET_SETTINGS, async (_event, settings: BudgetSettings) => {
    await saveBudgetSettings(settings);
    return settings;
  });
}
