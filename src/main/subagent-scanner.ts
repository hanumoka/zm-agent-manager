import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { SubagentInfo, ContentBlock, JsonlRecord } from '@shared/types';
import { parseLine } from './jsonl-parser';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const DEFAULT_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

export interface SubagentScannerOptions {
  projectsDir?: string;
}

/**
 * 특정 세션의 서브에이전트 목록을 스캔하여 반환
 */
export async function scanSessionSubagents(
  projectEncoded: string,
  sessionId: string,
  options: SubagentScannerOptions = {}
): Promise<SubagentInfo[]> {
  const projectsDir = options.projectsDir ?? DEFAULT_PROJECTS_DIR;
  const subagentsDir = join(projectsDir, projectEncoded, sessionId, 'subagents');

  let files: string[];
  try {
    files = await readdir(subagentsDir);
  } catch {
    // subagents 디렉토리가 없으면 빈 배열
    return [];
  }

  const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));
  if (jsonlFiles.length === 0) return [];

  const subagents = await Promise.all(
    jsonlFiles.map(async (jsonlFile) => {
      const agentId = jsonlFile.replace('agent-', '').replace('.jsonl', '');
      const jsonlPath = join(subagentsDir, jsonlFile);
      const metaPath = join(subagentsDir, jsonlFile.replace('.jsonl', '.meta.json'));

      // 메타데이터 읽기
      let agentType = 'unknown';
      let description = '';
      try {
        const metaContent = await readFile(metaPath, 'utf-8');
        const meta = JSON.parse(metaContent) as { agentType?: string; description?: string };
        agentType = meta.agentType ?? 'unknown';
        description = meta.description ?? '';
      } catch {
        // meta.json 없으면 기본값
      }

      // JSONL 파싱
      const records: JsonlRecord[] = [];
      let messageCount = 0;
      let toolCallCount = 0;

      const stream = createReadStream(jsonlPath, { encoding: 'utf-8' });
      const rl = createInterface({ input: stream, crlfDelay: Infinity });

      try {
        for await (const line of rl) {
          const record = parseLine(line);
          if (!record) continue;
          records.push(record);

          if (record.type === 'user' || record.type === 'assistant') {
            messageCount++;
          }
          if (record.type === 'assistant' && record.message?.content) {
            toolCallCount += (record.message.content as ContentBlock[]).filter(
              (b) => b.type === 'tool_use'
            ).length;
          }
        }
      } finally {
        rl.close();
        stream.destroy();
      }

      // 타임스탬프: 파일 mtime
      let timestamp = 0;
      try {
        const s = await stat(jsonlPath);
        timestamp = s.mtimeMs;
      } catch {
        // ignore
      }

      return {
        agentId,
        agentType,
        description,
        messageCount,
        toolCallCount,
        records,
        timestamp,
      };
    })
  );

  // 타임스탬프 순 정렬
  subagents.sort((a, b) => a.timestamp - b.timestamp);

  return subagents;
}
