import { readdir, stat } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from 'os';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import type { SearchResult, SearchResponse, SearchFilters } from '@shared/types';
import { parseHistoryFile } from './history-parser';

const DEFAULT_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

/**
 * 한 번의 검색 요청당 반환 가능한 최대 결과 수.
 * 이를 초과하는 매치는 수집되지 않으므로 `SearchResponse.totalMatches <= MAX_RESULTS` 항상 성립.
 * 향후 페이지네이션 도입 시 이 값을 페이지 크기로 분리할 수 있다.
 */
const MAX_RESULTS = 100;

/** 검색 서비스 옵션 (테스트에서 fixture 디렉토리 주입). */
export interface SearchOptions {
  /** 프로젝트 JSONL이 들어있는 루트 디렉토리. 기본값: `~/.claude/projects` */
  projectsDir?: string;
  /** history.jsonl 경로. 기본값: `~/.claude/history.jsonl` */
  historyFile?: string;
}

/**
 * 타임스탬프(string | number)를 epoch ms로 변환. 변환 실패 시 0.
 */
function toEpochMs(ts: string | number): number {
  if (typeof ts === 'number') return ts;
  const parsed = new Date(ts).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 단일 JSONL 파일에서 쿼리 텍스트 검색
 */
async function searchInJsonl(
  filePath: string,
  query: string,
  sessionId: string,
  projectName: string,
  projectPath: string,
  filters: SearchFilters
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

        // 기간 필터: 범위 밖이면 스킵
        // 빈 timestamp는 toEpochMs('') = 0 → 0 < dateFromMs 이므로 자동 제외된다.
        // 시간 정보가 없는 레코드를 기간 필터에서 빼는 것은 의도된 동작.
        if (filters.dateFromMs !== undefined || filters.dateToMs !== undefined) {
          const tsMs = toEpochMs(timestamp);
          if (filters.dateFromMs !== undefined && tsMs < filters.dateFromMs) continue;
          if (filters.dateToMs !== undefined && tsMs > filters.dateToMs) continue;
        }

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
 * 전체 세션에서 텍스트 검색 (옵션: 프로젝트명 / 기간 필터)
 */
export async function searchSessions(
  query: string,
  filters: SearchFilters = {},
  options: SearchOptions = {}
): Promise<SearchResponse> {
  if (!query.trim()) {
    return { query, results: [], totalMatches: 0 };
  }

  const projectsDir = options.projectsDir ?? DEFAULT_PROJECTS_DIR;
  const { projectPathMap } = await parseHistoryFile(options.historyFile);
  const allResults: SearchResult[] = [];

  let projectDirs: string[];
  try {
    projectDirs = await readdir(projectsDir);
  } catch {
    return { query, results: [], totalMatches: 0 };
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

    // 프로젝트 필터: 정확 일치 외 스킵
    if (filters.projectName && filters.projectName !== projectName) continue;

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
      const results = await searchInJsonl(
        filePath,
        query,
        sessionId,
        projectName,
        projectPath,
        filters
      );
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
