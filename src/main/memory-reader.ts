import { readFile, stat, readdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { MemoryContent } from '@shared/types';

const DEFAULT_PROJECTS_DIR = join(homedir(), '.claude', 'projects');
const MEMORY_LINE_LIMIT = 200;

/** 테스트에서 fixture 경로 주입. */
export interface MemoryReaderOptions {
  projectsDir?: string;
}

/**
 * 단일 프로젝트의 MEMORY.md 읽기.
 * 파일이 없으면 content=null, lineCount=0, sizeBytes=0으로 반환.
 */
export async function readMemoryContent(
  projectEncoded: string,
  options: MemoryReaderOptions = {}
): Promise<MemoryContent> {
  const projectsDir = options.projectsDir ?? DEFAULT_PROJECTS_DIR;
  const memoryDir = join(projectsDir, projectEncoded, 'memory');
  const filePath = join(memoryDir, 'MEMORY.md');
  const projectName = projectEncoded.split('-').pop() ?? projectEncoded;

  try {
    const [content, fileStat] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)]);
    const lineCount = content.split(/\r?\n/).length;
    return {
      projectEncoded,
      projectName,
      content,
      lineCount,
      sizeBytes: fileStat.size,
      filePath,
      exceedsLimit: lineCount > MEMORY_LINE_LIMIT,
    };
  } catch {
    return {
      projectEncoded,
      projectName,
      content: null,
      lineCount: 0,
      sizeBytes: 0,
      filePath,
      exceedsLimit: false,
    };
  }
}

/**
 * 모든 프로젝트의 MEMORY.md 요약 목록.
 * content는 포함하지 않고 lineCount/sizeBytes/exceedsLimit만 반환 (리스트 표시용).
 */
export async function listProjectMemories(
  options: MemoryReaderOptions = {}
): Promise<Omit<MemoryContent, 'content'>[]> {
  const projectsDir = options.projectsDir ?? DEFAULT_PROJECTS_DIR;

  let dirs: string[];
  try {
    dirs = await readdir(projectsDir);
  } catch {
    return [];
  }

  const results = await Promise.all(
    dirs.map(async (encodedDir) => {
      const memoryDir = join(projectsDir, encodedDir, 'memory');
      const filePath = join(memoryDir, 'MEMORY.md');
      const projectName = encodedDir.split('-').pop() ?? encodedDir;
      try {
        const fileStat = await stat(filePath);
        const content = await readFile(filePath, 'utf-8');
        const lineCount = content.split(/\r?\n/).length;
        return {
          projectEncoded: encodedDir,
          projectName,
          lineCount,
          sizeBytes: fileStat.size,
          filePath,
          exceedsLimit: lineCount > MEMORY_LINE_LIMIT,
        };
      } catch {
        return null;
      }
    })
  );

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}
