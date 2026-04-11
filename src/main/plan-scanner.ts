import { readdir, stat } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from 'os';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import type { PlanInfo } from '@shared/types';
import { parseHistoryFile } from './history-parser';

const DEFAULT_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

export interface PlanScannerOptions {
  projectsDir?: string;
  historyFile?: string;
}

/**
 * 단일 JSONL 파일에서 ExitPlanMode 이벤트 추출
 */
async function extractPlansFromJsonl(
  filePath: string,
  sessionId: string,
  projectName: string
): Promise<PlanInfo[]> {
  const plans: PlanInfo[] = [];

  let stream;
  let rl;

  try {
    stream = createReadStream(filePath, { encoding: 'utf-8' });
    rl = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.includes('ExitPlanMode')) continue;

      try {
        const raw = JSON.parse(line) as Record<string, unknown>;
        if (raw.type !== 'assistant') continue;

        const message = raw.message as { content?: unknown[] } | undefined;
        if (!message?.content || !Array.isArray(message.content)) continue;

        const timestamp = (raw.timestamp as string | number) ?? '';

        for (const block of message.content) {
          const b = block as {
            type?: string;
            name?: string;
            input?: Record<string, unknown>;
          };
          if (b.type !== 'tool_use' || b.name !== 'ExitPlanMode' || !b.input) continue;

          const planText = (b.input.plan as string) ?? '';
          const planFilePath = (b.input.planFilePath as string) ?? '';
          const allowedPrompts = Array.isArray(b.input.allowedPrompts)
            ? (b.input.allowedPrompts as { tool: string; prompt: string }[])
            : [];

          // 제목: 마크다운 첫 줄의 # 제거
          const firstLine = planText.split('\n').find((l) => l.trim().length > 0) ?? '';
          const title = firstLine.replace(/^#+\s*/, '').trim() || '(무제)';

          plans.push({
            title,
            content: planText,
            filePath: planFilePath,
            allowedPrompts,
            timestamp,
            sessionId,
            projectName,
          });
        }
      } catch {
        // 잘못된 JSON 라인 스킵
      }
    }
  } finally {
    rl?.close();
    stream?.destroy();
  }

  return plans;
}

/**
 * 모든 프로젝트의 JSONL에서 플랜 추출
 */
export async function scanAllPlans(
  options: PlanScannerOptions = {}
): Promise<PlanInfo[]> {
  const projectsDir = options.projectsDir ?? DEFAULT_PROJECTS_DIR;
  const { projectPathMap } = await parseHistoryFile(options.historyFile);
  const allPlans: PlanInfo[] = [];

  let projectDirs: string[];
  try {
    projectDirs = await readdir(projectsDir);
  } catch {
    return [];
  }

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

    const results = await Promise.all(
      jsonlFiles.map(async (jsonlFile) => {
        const sessionId = jsonlFile.replace('.jsonl', '');
        const fp = join(projectDir, jsonlFile);
        return extractPlansFromJsonl(fp, sessionId, projectName);
      })
    );

    for (const plans of results) {
      allPlans.push(...plans);
    }
  }

  // 최신 순 정렬
  allPlans.sort((a, b) => {
    const ta = typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : a.timestamp;
    const tb = typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : b.timestamp;
    return tb - ta;
  });

  return allPlans;
}
