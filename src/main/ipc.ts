import { join } from 'path';
import { homedir } from 'os';
import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  type SearchFilters,
  type BudgetSettings,
  type TaskMetadata,
  type WorkflowDefinition,
  type DocReview,
  type NotificationSettings,
} from '@shared/types';
import { scanAllSessions } from './session-scanner';
import { parseJsonlFile } from './jsonl-parser';
import { watchSession, unwatchSession } from './session-watcher';
import { scanAllTasks } from './task-scanner';
import { scanCostSummary } from './cost-scanner';
import { scanSessionSubagents } from './subagent-scanner';
import { scanProjectDocs } from './doc-scanner';
import { searchSessions } from './search-service';
import { loadBudgetSettings, saveBudgetSettings, evaluateBudgetAlerts } from './budget-service';
import { scanStatsSummary } from './stats-service';
import { scanSkills } from './skill-scanner';
import { readMemoryContent } from './memory-reader';
import { scanAgents } from './agent-scanner';
import { scanConfigSummary } from './config-scanner';
import {
  getTaskMetadata,
  setTaskMetadata,
  listAllTaskMetadata,
} from './task-metadata-service';
import { listWorkflows, saveWorkflow, deleteWorkflow } from './workflow-service';
import { getDocReview, setDocReview } from './doc-review-service';
import { getNotificationSettings, setNotificationSettings } from './notification-settings-service';
import {
  getNotificationHistory,
  markNotificationRead,
  clearNotificationHistory,
} from './notification-history-service';
import { getFileVersions, getFileBackupContent } from './file-history-service';
import { scanAllPlans } from './plan-scanner';
import { lintClaudeMd } from './claude-md-linter';
import { getSidebarSettings, setSidebarSettings } from './sidebar-settings-service';
import type { SidebarSettings } from './sidebar-settings-service';
import { scanHandoffs } from './handoff-scanner';
import { getProjectSettings, setProjectSettings } from './project-settings-service';
import { __clearCurrentProjectPathCache } from './current-project';
import { parseHistoryFile } from './history-parser';
import { stat } from 'fs/promises';
import {
  scanProjectWorkflow,
  scanProjectWorkflowList,
  saveProjectWorkflow,
  deleteProjectWorkflow,
} from './workflow-scanner';
import { validateWorkflow } from './workflow-validator';

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
    // 비용 갱신 시 예산 임계 평가 (실패해도 비용 응답에 영향 없음, 로그는 남김)
    void evaluateBudgetAlerts(summary).catch((err) => {
      console.error('[budget] evaluate failed', err);
    });
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

  ipcMain.handle(IPC_CHANNELS.GET_STATS_SUMMARY, async () => {
    return scanStatsSummary();
  });

  ipcMain.handle(IPC_CHANNELS.GET_SKILLS, async () => {
    return scanSkills();
  });

  ipcMain.handle(IPC_CHANNELS.GET_MEMORY_CONTENT, async (_event, projectEncoded: string) => {
    return readMemoryContent(projectEncoded);
  });

  ipcMain.handle(IPC_CHANNELS.GET_AGENTS, async () => {
    return scanAgents();
  });

  ipcMain.handle(IPC_CHANNELS.GET_CONFIG_SUMMARY, async () => {
    return scanConfigSummary();
  });

  ipcMain.handle(IPC_CHANNELS.GET_BUDGET_SETTINGS, async () => {
    return loadBudgetSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SET_BUDGET_SETTINGS, async (_event, settings: BudgetSettings) => {
    const saved = await saveBudgetSettings(settings);
    return saved;
  });

  ipcMain.handle(IPC_CHANNELS.GET_TASK_METADATA, async (_event, taskId: string) => {
    return getTaskMetadata(taskId);
  });

  ipcMain.handle(IPC_CHANNELS.SET_TASK_METADATA, async (_event, metadata: TaskMetadata) => {
    return setTaskMetadata(metadata);
  });

  ipcMain.handle(IPC_CHANNELS.GET_WORKFLOWS, async () => {
    return listWorkflows();
  });

  ipcMain.handle(IPC_CHANNELS.SET_WORKFLOW, async (_event, workflow: WorkflowDefinition) => {
    return saveWorkflow(workflow);
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_WORKFLOW, async (_event, name: string) => {
    return deleteWorkflow(name);
  });

  ipcMain.handle(IPC_CHANNELS.GET_DOC_REVIEW, async (_event, docPath: string) => {
    return getDocReview(docPath);
  });

  ipcMain.handle(IPC_CHANNELS.SET_DOC_REVIEW, async (_event, review: DocReview) => {
    return setDocReview(review);
  });

  ipcMain.handle(IPC_CHANNELS.GET_NOTIFICATION_SETTINGS, async () => {
    return getNotificationSettings();
  });

  ipcMain.handle(
    IPC_CHANNELS.SET_NOTIFICATION_SETTINGS,
    async (_event, settings: NotificationSettings) => {
      return setNotificationSettings(settings);
    }
  );

  ipcMain.handle(IPC_CHANNELS.GET_NOTIFICATION_HISTORY, async () => {
    return getNotificationHistory();
  });

  ipcMain.handle(IPC_CHANNELS.MARK_NOTIFICATION_READ, async (_event, id: string) => {
    return markNotificationRead(id);
  });

  ipcMain.handle(IPC_CHANNELS.CLEAR_NOTIFICATION_HISTORY, async () => {
    return clearNotificationHistory();
  });

  ipcMain.handle(
    IPC_CHANNELS.GET_FILE_VERSIONS,
    async (_event, sessionId: string, projectEncoded: string) => {
      return getFileVersions(sessionId, projectEncoded);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_FILE_CONTENT,
    async (_event, sessionId: string, backupFileName: string) => {
      return getFileBackupContent(sessionId, backupFileName);
    }
  );

  ipcMain.handle(IPC_CHANNELS.GET_ALL_PLANS, async () => {
    return scanAllPlans();
  });

  ipcMain.handle(IPC_CHANNELS.LINT_CLAUDE_MD, async (_event, projectPath: string) => {
    return lintClaudeMd(projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.GET_SIDEBAR_SETTINGS, async () => {
    return getSidebarSettings();
  });

  ipcMain.handle(
    IPC_CHANNELS.SET_SIDEBAR_SETTINGS,
    async (_event, settings: SidebarSettings) => {
      return setSidebarSettings(settings);
    }
  );

  ipcMain.handle(IPC_CHANNELS.GET_HANDOFFS, async () => {
    return scanHandoffs();
  });

  ipcMain.handle(IPC_CHANNELS.GET_PROJECT_SETTINGS, async () => {
    return getProjectSettings();
  });

  ipcMain.handle(
    IPC_CHANNELS.SET_PROJECT_SETTINGS,
    async (_event, settings: { currentProjectPath: string | null }) => {
      const saved = await setProjectSettings(settings);
      __clearCurrentProjectPathCache();
      return saved;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_PROJECT_WORKFLOW,
    async (_event, projectPath?: string, workflowName?: string) => {
      const options: { projectPath?: string; workflowName?: string } = {};
      if (projectPath) options.projectPath = projectPath;
      if (workflowName) options.workflowName = workflowName;
      return scanProjectWorkflow(options);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.LIST_PROJECT_WORKFLOWS,
    async (_event, projectPath?: string) => {
      return scanProjectWorkflowList(projectPath);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SAVE_PROJECT_WORKFLOW,
    async (_event, projectPath: string, workflow: WorkflowDefinition) => {
      const validation = validateWorkflow(workflow);
      if (!validation.valid) {
        const msg = validation.errors.map((e) => `[${e.rule}] ${e.message}`).join('\n');
        throw new Error(`워크플로우 검증 실패:\n${msg}`);
      }
      return saveProjectWorkflow(projectPath, workflow);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.DELETE_PROJECT_WORKFLOW,
    async (_event, projectPath: string, name: string) => {
      return deleteProjectWorkflow(projectPath, name);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.VALIDATE_PROJECT_WORKFLOW,
    async (_event, workflow: WorkflowDefinition) => {
      return validateWorkflow(workflow);
    }
  );

  ipcMain.handle(IPC_CHANNELS.GET_ALL_TASK_METADATA, async () => {
    return listAllTaskMetadata();
  });

  ipcMain.handle(IPC_CHANNELS.GET_KNOWN_PROJECTS, async () => {
    // history.jsonl에서 projectPathMap을 얻고, 각 경로의 최근 활동 시각을 계산
    const { sessionMap, projectPathMap } = await parseHistoryFile();
    const pathToLatestTs = new Map<string, number>();
    for (const entries of sessionMap.values()) {
      for (const e of entries) {
        if (!e.project) continue;
        const prev = pathToLatestTs.get(e.project) ?? 0;
        if (e.timestamp > prev) pathToLatestTs.set(e.project, e.timestamp);
      }
    }
    // projectPathMap의 값(실제 경로)을 사용 — 인코딩된 키는 불필요
    const uniquePaths = new Set<string>(projectPathMap.values());
    for (const p of pathToLatestTs.keys()) uniquePaths.add(p);
    const results: { path: string; lastActivity: number }[] = [];
    for (const path of uniquePaths) {
      // 절대 경로만 포함 (인코딩된 디렉토리명 배제)
      const isAbs = path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path);
      if (!isAbs) continue;
      // 경로가 실제로 존재하는지 확인 (선택적 — 삭제된 프로젝트 필터)
      try {
        const s = await stat(path);
        if (!s.isDirectory()) continue;
      } catch {
        continue;
      }
      results.push({ path, lastActivity: pathToLatestTs.get(path) ?? 0 });
    }
    results.sort((a, b) => b.lastActivity - a.lastActivity);
    return results;
  });
}
