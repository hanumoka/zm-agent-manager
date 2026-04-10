import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import type { CostSummary, ModelCost, DailyCost } from '@shared/types';
import { calculateCost } from '@shared/pricing';
import { timestampToLocalDate } from './budget-service';

const DEFAULT_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

/** 테스트에서 fixture 디렉토리 주입. */
export interface CostScannerOptions {
  /** JSONL이 들어있는 루트 디렉토리. 기본값: `~/.claude/projects` */
  projectsDir?: string;
}

// 모델별 가격은 @shared/pricing.ts에서 import (DRY)

interface UsageRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  timestamp: string;
}

/**
 * 단일 JSONL 파일에서 usage 레코드 추출
 */
async function extractUsageFromJsonl(filePath: string): Promise<UsageRecord[]> {
  const records: UsageRecord[] = [];

  let stream;
  let rl;

  try {
    stream = createReadStream(filePath, { encoding: 'utf-8' });
    rl = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      // 빠른 사전 필터
      if (!line.includes('"usage"')) continue;

      try {
        const raw = JSON.parse(line) as Record<string, unknown>;
        if (raw.type !== 'assistant') continue;

        const message = raw.message as
          | {
              model?: string;
              usage?: {
                input_tokens?: number;
                output_tokens?: number;
                cache_read_input_tokens?: number;
                cache_creation_input_tokens?: number;
              };
            }
          | undefined;

        if (!message?.usage || !message.model) continue;

        const u = message.usage;
        records.push({
          model: message.model,
          inputTokens: u.input_tokens ?? 0,
          outputTokens: u.output_tokens ?? 0,
          cacheReadTokens: u.cache_read_input_tokens ?? 0,
          cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
          timestamp: String(raw.timestamp ?? ''),
        });
      } catch {
        // 파싱 실패 스킵
      }
    }
  } finally {
    rl?.close();
    stream?.destroy();
  }

  return records;
}

/**
 * 모든 세션에서 비용 요약 생성
 */
export async function scanCostSummary(options: CostScannerOptions = {}): Promise<CostSummary> {
  const projectsDir = options.projectsDir ?? DEFAULT_PROJECTS_DIR;
  let projectDirs: string[];
  try {
    projectDirs = await readdir(projectsDir);
  } catch {
    return {
      totalCost: 0,
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      byModel: [],
      byDay: [],
    };
  }

  const allUsage: UsageRecord[] = [];

  for (const encodedDir of projectDirs) {
    const projectDir = join(projectsDir, encodedDir);

    try {
      const s = await stat(projectDir);
      if (!s.isDirectory()) continue;
    } catch {
      continue;
    }

    let files: string[];
    try {
      files = await readdir(projectDir);
    } catch {
      continue;
    }

    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

    const results = await Promise.all(
      jsonlFiles.map((f) => extractUsageFromJsonl(join(projectDir, f)))
    );

    for (const records of results) {
      allUsage.push(...records);
    }
  }

  // 모델별 집계
  const modelMap = new Map<string, ModelCost>();
  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const u of allUsage) {
    const cost = calculateCost(
      u.model,
      u.inputTokens,
      u.outputTokens,
      u.cacheReadTokens,
      u.cacheWriteTokens
    );
    totalCost += cost;
    totalInputTokens += u.inputTokens;
    totalOutputTokens += u.outputTokens;

    const existing = modelMap.get(u.model);
    if (existing) {
      existing.inputTokens += u.inputTokens;
      existing.outputTokens += u.outputTokens;
      existing.cacheReadTokens += u.cacheReadTokens;
      existing.cacheWriteTokens += u.cacheWriteTokens;
      existing.cost += cost;
      existing.requestCount += 1;
    } else {
      modelMap.set(u.model, {
        model: u.model,
        inputTokens: u.inputTokens,
        outputTokens: u.outputTokens,
        cacheReadTokens: u.cacheReadTokens,
        cacheWriteTokens: u.cacheWriteTokens,
        cost,
        requestCount: 1,
      });
    }
  }

  // 일별 집계 (로컬 시각 기준 — budget-service.todayLocal과 동일 키 체계)
  const dayMap = new Map<string, DailyCost>();
  for (const u of allUsage) {
    const date = timestampToLocalDate(u.timestamp);
    const cost = calculateCost(
      u.model,
      u.inputTokens,
      u.outputTokens,
      u.cacheReadTokens,
      u.cacheWriteTokens
    );

    const existing = dayMap.get(date);
    if (existing) {
      existing.cost += cost;
      existing.requestCount += 1;
    } else {
      dayMap.set(date, { date, cost, requestCount: 1 });
    }
  }

  const byModel = [...modelMap.values()].sort((a, b) => b.cost - a.cost);
  const byDay = [...dayMap.values()]
    .filter((d) => d.date !== 'unknown')
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    totalRequests: allUsage.length,
    totalInputTokens,
    totalOutputTokens,
    byModel,
    byDay,
  };
}
