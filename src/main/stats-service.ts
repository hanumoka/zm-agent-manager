import { readdir, stat } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from 'os';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import type {
  StatsSummary,
  DailyActivity,
  HeatmapCell,
  ProjectStats,
  ModelTokenUsage,
} from '@shared/types';
import { parseHistoryFile } from './history-parser';
import { calculateCost } from '@shared/pricing';
import { timestampToLocalDate } from './budget-service';

const DEFAULT_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

/** 테스트에서 fixture 디렉토리 주입. */
export interface StatsOptions {
  projectsDir?: string;
  historyFile?: string;
  /** dailyActivity 윈도우 (일). 기본 30 */
  dailyWindowDays?: number;
}

interface SessionLevelStats {
  sessionId: string;
  projectName: string;
  projectPath: string;
  messageCount: number;
  toolCallCount: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** 로컬 날짜별 레코드/도구 수 집계 — dailyActivity 빌드에 사용 */
  perDay: Map<string, { messages: number; tools: number }>;
  /** 이 세션이 활성이었던 로컬 날짜들 (sessionCount 집계에 사용) */
  activeDates: Set<string>;
  /** 모델별 토큰 집계 */
  perModel: Map<string, ModelTokenUsage>;
}

/** 단일 JSONL 파일을 스트리밍으로 파싱하여 세션 단위 통계 생성 */
async function collectSessionStats(
  filePath: string,
  sessionId: string,
  projectName: string,
  projectPath: string
): Promise<SessionLevelStats> {
  const stats: SessionLevelStats = {
    sessionId,
    projectName,
    projectPath,
    messageCount: 0,
    toolCallCount: 0,
    cost: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    perDay: new Map(),
    activeDates: new Set(),
    perModel: new Map(),
  };

  let stream;
  let rl;
  try {
    stream = createReadStream(filePath, { encoding: 'utf-8' });
    rl = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const raw = JSON.parse(line) as Record<string, unknown>;
        const type = raw.type as string;
        if (type !== 'user' && type !== 'assistant') continue;

        const timestamp = (raw.timestamp as string | number) ?? '';
        const date = timestampToLocalDate(timestamp);

        // messageCount (user + assistant 모두)
        stats.messageCount += 1;
        if (date !== 'unknown') {
          stats.activeDates.add(date);
          const entry = stats.perDay.get(date) ?? { messages: 0, tools: 0 };
          entry.messages += 1;
          stats.perDay.set(date, entry);
        }

        if (type !== 'assistant') continue;

        // assistant 전용: tool_use 카운트 + usage 집계
        const message = raw.message as
          | {
              content?: unknown[];
              model?: string;
              usage?: {
                input_tokens?: number;
                output_tokens?: number;
                cache_read_input_tokens?: number;
                cache_creation_input_tokens?: number;
              };
            }
          | undefined;

        if (Array.isArray(message?.content)) {
          const toolBlocks = (message.content as Record<string, unknown>[]).filter(
            (b) => b.type === 'tool_use'
          );
          stats.toolCallCount += toolBlocks.length;
          if (toolBlocks.length > 0 && date !== 'unknown') {
            const entry = stats.perDay.get(date) ?? { messages: 0, tools: 0 };
            entry.tools += toolBlocks.length;
            stats.perDay.set(date, entry);
          }
        }

        if (message?.model && message?.usage) {
          const model = message.model;
          const u = message.usage;
          const input = u.input_tokens ?? 0;
          const output = u.output_tokens ?? 0;
          const cacheRead = u.cache_read_input_tokens ?? 0;
          const cacheWrite = u.cache_creation_input_tokens ?? 0;

          stats.inputTokens += input;
          stats.outputTokens += output;
          stats.cacheReadTokens += cacheRead;
          stats.cacheWriteTokens += cacheWrite;
          stats.cost += calculateCost(model, input, output, cacheRead, cacheWrite);

          const existing = stats.perModel.get(model) ?? {
            model,
            inputTokens: 0,
            outputTokens: 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            totalTokens: 0,
          };
          existing.inputTokens += input;
          existing.outputTokens += output;
          existing.cacheReadTokens += cacheRead;
          existing.cacheWriteTokens += cacheWrite;
          existing.totalTokens =
            existing.inputTokens +
            existing.outputTokens +
            existing.cacheReadTokens +
            existing.cacheWriteTokens;
          stats.perModel.set(model, existing);
        }
      } catch {
        // 파싱 실패 스킵
      }
    }
  } catch {
    // 파일 열기 실패 — 빈 통계 반환
  } finally {
    rl?.close();
    stream?.destroy();
  }

  return stats;
}

/** 최근 N일 날짜 배열 (로컬, 오름차순, "YYYY-MM-DD") */
function recentDates(days: number, now: Date = new Date()): string[] {
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    result.push(`${y}-${m}-${dd}`);
  }
  return result;
}

/**
 * 전체 세션에서 통계 집계
 * JSONL을 직접 재집계하여 cost-scanner와 일관된 결과를 보장한다.
 */
export async function scanStatsSummary(options: StatsOptions = {}): Promise<StatsSummary> {
  const projectsDir = options.projectsDir ?? DEFAULT_PROJECTS_DIR;
  const dailyWindowDays = options.dailyWindowDays ?? 30;
  const now = new Date();

  const { sessionMap, projectPathMap } = await parseHistoryFile(options.historyFile);

  let projectDirs: string[];
  try {
    projectDirs = await readdir(projectsDir);
  } catch {
    return emptyStats(dailyWindowDays, now);
  }

  const allSessionStats: SessionLevelStats[] = [];

  for (const encodedDir of projectDirs) {
    const projectDir = join(projectsDir, encodedDir);
    try {
      const s = await stat(projectDir);
      if (!s.isDirectory()) continue;
    } catch {
      continue;
    }

    const projectPath = projectPathMap.get(encodedDir) ?? encodedDir;
    const projectName = projectPathMap.has(encodedDir)
      ? basename(projectPath)
      : (encodedDir.split('-').pop() ?? encodedDir);

    let files: string[];
    try {
      files = await readdir(projectDir);
    } catch {
      continue;
    }

    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));
    const sessionStatsList = await Promise.all(
      jsonlFiles.map((f) => {
        const sessionId = f.replace('.jsonl', '');
        return collectSessionStats(join(projectDir, f), sessionId, projectName, projectPath);
      })
    );

    allSessionStats.push(...sessionStatsList);
  }

  // ─── 전체 집계 ───
  const totalSessions = allSessionStats.length;
  const totalMessages = allSessionStats.reduce((a, s) => a + s.messageCount, 0);
  const totalToolCalls = allSessionStats.reduce((a, s) => a + s.toolCallCount, 0);
  const totalTokens = allSessionStats.reduce(
    (a, s) => a + s.inputTokens + s.outputTokens + s.cacheReadTokens + s.cacheWriteTokens,
    0
  );

  // ─── dailyActivity ─── (최근 N일, 데이터 없어도 0으로 채움)
  const dateWindow = recentDates(dailyWindowDays, now);
  const dailyActivityMap = new Map<string, DailyActivity>();
  for (const d of dateWindow) {
    dailyActivityMap.set(d, { date: d, messageCount: 0, sessionCount: 0, toolCallCount: 0 });
  }
  // 각 날짜의 활성 세션 집계용
  const sessionsByDate = new Map<string, Set<string>>();

  for (const session of allSessionStats) {
    for (const [date, perDayStats] of session.perDay.entries()) {
      const entry = dailyActivityMap.get(date);
      if (entry) {
        entry.messageCount += perDayStats.messages;
        entry.toolCallCount += perDayStats.tools;
      }
      // 윈도우 밖이라도 sessionCount 집계는 함 (but windowmap에 없으므로 무시됨)
    }
    for (const date of session.activeDates) {
      if (!dailyActivityMap.has(date)) continue;
      const set = sessionsByDate.get(date) ?? new Set<string>();
      set.add(session.sessionId);
      sessionsByDate.set(date, set);
    }
  }
  for (const [date, sessions] of sessionsByDate.entries()) {
    const entry = dailyActivityMap.get(date);
    if (entry) entry.sessionCount = sessions.size;
  }
  const dailyActivity = [...dailyActivityMap.values()];

  // ─── heatmap (7×24) ───
  // 주의: heatmap과 dailyActivity는 데이터 소스가 다르다.
  //   - heatmap: history.jsonl 엔트리(사용자 프롬프트 입력 시점)만 기반
  //   - dailyActivity: JSONL 세션 파일의 모든 user/assistant 레코드 기반
  // 따라서 같은 날짜의 "총 활동"과 히트맵 셀 합계는 일치하지 않을 수 있다.
  // 이는 의도된 설계 — heatmap은 "언제 사용자가 프롬프트를 입력했나"를,
  // dailyActivity는 "전체 대화 볼륨"을 보여준다.
  const heatmap: HeatmapCell[] = [];
  const heatmapMap = new Map<string, number>();
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      heatmapMap.set(`${d}-${h}`, 0);
    }
  }
  for (const entries of sessionMap.values()) {
    for (const entry of entries) {
      const date = new Date(entry.timestamp);
      if (!Number.isFinite(date.getTime())) continue;
      const key = `${date.getDay()}-${date.getHours()}`;
      heatmapMap.set(key, (heatmapMap.get(key) ?? 0) + 1);
    }
  }
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      heatmap.push({ dayOfWeek: d, hour: h, count: heatmapMap.get(`${d}-${h}`) ?? 0 });
    }
  }

  // ─── byProject ───
  const projectMap = new Map<string, ProjectStats>();
  for (const session of allSessionStats) {
    const existing = projectMap.get(session.projectName) ?? {
      projectName: session.projectName,
      projectPath: session.projectPath,
      sessionCount: 0,
      messageCount: 0,
      toolCallCount: 0,
      cost: 0,
    };
    existing.sessionCount += 1;
    existing.messageCount += session.messageCount;
    existing.toolCallCount += session.toolCallCount;
    existing.cost += session.cost;
    projectMap.set(session.projectName, existing);
  }
  const byProject = [...projectMap.values()].sort((a, b) => b.cost - a.cost);

  // ─── byModel ───
  const modelMap = new Map<string, ModelTokenUsage>();
  for (const session of allSessionStats) {
    for (const [model, usage] of session.perModel.entries()) {
      const existing = modelMap.get(model) ?? {
        model,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 0,
      };
      existing.inputTokens += usage.inputTokens;
      existing.outputTokens += usage.outputTokens;
      existing.cacheReadTokens += usage.cacheReadTokens;
      existing.cacheWriteTokens += usage.cacheWriteTokens;
      existing.totalTokens =
        existing.inputTokens +
        existing.outputTokens +
        existing.cacheReadTokens +
        existing.cacheWriteTokens;
      modelMap.set(model, existing);
    }
  }
  const byModel = [...modelMap.values()].sort((a, b) => b.totalTokens - a.totalTokens);

  return {
    totalSessions,
    totalMessages,
    totalTokens,
    totalToolCalls,
    dailyActivity,
    heatmap,
    byProject,
    byModel,
  };
}

function emptyStats(dailyWindowDays: number, now: Date): StatsSummary {
  const dailyActivity = recentDates(dailyWindowDays, now).map((date) => ({
    date,
    messageCount: 0,
    sessionCount: 0,
    toolCallCount: 0,
  }));
  const heatmap: HeatmapCell[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      heatmap.push({ dayOfWeek: d, hour: h, count: 0 });
    }
  }
  return {
    totalSessions: 0,
    totalMessages: 0,
    totalTokens: 0,
    totalToolCalls: 0,
    dailyActivity,
    heatmap,
    byProject: [],
    byModel: [],
  };
}
