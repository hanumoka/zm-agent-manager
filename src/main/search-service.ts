import { readdir, stat } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from 'os';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import type { SearchResult, SearchResponse } from '@shared/types';
import { parseHistoryFile } from './history-parser';

const PROJECTS_DIR = join(homedir(), '.claude', 'projects');
const MAX_RESULTS = 100;

/**
 * 단일 JSONL 파일에서 쿼리 텍스트 검색
 */
async function searchInJsonl(
  filePath: string,
  query: string,
  sessionId: string,
  projectName: string,
  projectPath: string
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  let stream;
  let rl;

  try {
    stream = createReadStream(filePath, { encoding: 'utf-8' });
    rl = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      // 빠른 사전 필터: 쿼리 문자열 포함 여부
      if (!line.toLowerCase().includes(lowerQuery)) continue;

      try {
        const raw = JSON.parse(line) as Record<string, unknown>;
        const type = raw.type as string;
        if (type !== 'user' && type !== 'assistant') continue;

        const message = raw.message as { content?: unknown } | undefined;
        if (!message?.content) continue;

        const timestamp = (raw.timestamp as string | number) ?? '';

        // user 메시지: string content
        if (type === 'user' && typeof message.content === 'string') {
          if (message.content.toLowerCase().includes(lowerQuery)) {
            results.push({
              sessionId,
              projectName,
              projectPath,
              matchText: extractSnippet(message.content, lowerQuery),
              recordType: 'user',
              timestamp,
            });
          }
        }

        // assistant 메시지: ContentBlock[] 검색
        if (type === 'assistant' && Array.isArray(message.content)) {
          for (const block of message.content as Record<string, unknown>[]) {
            const blockType = block.type as string;

            if (blockType === 'text') {
              const text = block.text as string;
              if (text?.toLowerCase().includes(lowerQuery)) {
                results.push({
                  sessionId,
                  projectName,
                  projectPath,
                  matchText: extractSnippet(text, lowerQuery),
                  recordType: 'assistant',
                  timestamp,
                });
                break; // 레코드당 1개 결과
              }
            }

            if (blockType === 'tool_use') {
              const name = block.name as string;
              const input = block.input as Record<string, unknown> | undefined;
              const inputStr = JSON.stringify(input ?? {});
              if (
                name?.toLowerCase().includes(lowerQuery) ||
                inputStr.toLowerCase().includes(lowerQuery)
              ) {
                results.push({
                  sessionId,
                  projectName,
                  projectPath,
                  matchText: extractSnippet(`[${name}] ${inputStr}`, lowerQuery),
                  recordType: 'assistant',
                  timestamp,
                  toolName: name,
                });
                break;
              }
            }
          }
        }

        if (results.length >= MAX_RESULTS) break;
      } catch {
        // 파싱 실패 스킵
      }
    }
  } finally {
    rl?.close();
    stream?.destroy();
  }

  return results;
}

/**
 * 쿼리 주변 텍스트 스니펫 추출
 */
function extractSnippet(text: string, lowerQuery: string, contextLen: number = 80): string {
  const lowerText = text.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return text.slice(0, contextLen * 2);

  const start = Math.max(0, idx - contextLen);
  const end = Math.min(text.length, idx + lowerQuery.length + contextLen);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

/**
 * 전체 세션에서 텍스트 검색
 */
export async function searchSessions(query: string): Promise<SearchResponse> {
  if (!query.trim()) {
    return { query, results: [], totalMatches: 0 };
  }

  const { projectPathMap } = await parseHistoryFile();
  const allResults: SearchResult[] = [];

  let projectDirs: string[];
  try {
    projectDirs = await readdir(PROJECTS_DIR);
  } catch {
    return { query, results: [], totalMatches: 0 };
  }

  for (const encodedDir of projectDirs) {
    const projectDir = join(PROJECTS_DIR, encodedDir);

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

    for (const jsonlFile of jsonlFiles) {
      const sessionId = jsonlFile.replace('.jsonl', '');
      const filePath = join(projectDir, jsonlFile);
      const results = await searchInJsonl(filePath, query, sessionId, projectName, projectPath);
      allResults.push(...results);

      if (allResults.length >= MAX_RESULTS) break;
    }

    if (allResults.length >= MAX_RESULTS) break;
  }

  // 최신순 정렬
  allResults.sort((a, b) => {
    const tsA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
    const tsB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
    return tsB - tsA;
  });

  return {
    query,
    results: allResults.slice(0, MAX_RESULTS),
    totalMatches: allResults.length,
  };
}
