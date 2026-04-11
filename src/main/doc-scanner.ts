import { readdir, readFile, stat } from 'fs/promises';
import { join, relative, basename } from 'path';
import { homedir } from 'os';
import type { DocInfo } from '@shared/types';

const DEFAULT_CLAUDE_MEMORY_BASE = join(homedir(), '.claude', 'projects');

export interface DocScannerOptions {
  claudeMemoryBase?: string;
}

interface ScanTarget {
  /** 스캔할 경로 (프로젝트 루트 기준 상대 또는 절대) */
  path: string;
  /** 카테고리 라벨 */
  category: string;
  /** glob 패턴 (확장자) */
  extensions: string[];
  /** 재귀 스캔 여부 */
  recursive: boolean;
}

/**
 * 디렉토리 내 파일을 재귀적으로 수집
 */
async function collectFiles(
  dirPath: string,
  extensions: string[],
  recursive: boolean
): Promise<string[]> {
  const results: string[] = [];

  let entries: string[];
  try {
    entries = await readdir(dirPath);
  } catch {
    return [];
  }

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    try {
      const s = await stat(fullPath);
      if (s.isDirectory() && recursive) {
        const nested = await collectFiles(fullPath, extensions, true);
        results.push(...nested);
      } else if (s.isFile()) {
        if (extensions.length === 0 || extensions.some((ext) => entry.endsWith(ext))) {
          results.push(fullPath);
        }
      }
    } catch {
      // 접근 불가 파일 스킵
    }
  }

  return results;
}

/**
 * 파일의 라인 수를 카운트
 */
async function countLines(filePath: string): Promise<number> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return content.split(/\r?\n/).length;
  } catch {
    return 0;
  }
}

/**
 * 프로젝트의 관리 문서를 스캔하여 반환
 */
export async function scanProjectDocs(
  projectPath: string,
  options: DocScannerOptions = {}
): Promise<DocInfo[]> {
  const docs: DocInfo[] = [];

  // 스캔 대상 정의
  const targets: ScanTarget[] = [
    { path: join(projectPath, 'CLAUDE.md'), category: 'Config', extensions: [], recursive: false },
    {
      path: join(projectPath, '.claude', 'rules'),
      category: 'Rules',
      extensions: ['.md'],
      recursive: false,
    },
    {
      path: join(projectPath, '.claude', 'skills'),
      category: 'Skills',
      extensions: ['.md'],
      recursive: true,
    },
    {
      path: join(projectPath, '.claude', 'agents'),
      category: 'Agents',
      extensions: ['.md'],
      recursive: false,
    },
    {
      path: join(projectPath, 'docs'),
      category: 'Docs',
      extensions: ['.md'],
      recursive: true,
    },
  ];

  // MEMORY.md (claude data dir)
  const encodedPath = projectPath.replace(/[\\/:]/g, '-');
  const claudeMemoryBase = options.claudeMemoryBase ?? DEFAULT_CLAUDE_MEMORY_BASE;
  const memoryDir = join(claudeMemoryBase, encodedPath, 'memory');
  targets.push({
    path: memoryDir,
    category: 'Memory',
    extensions: ['.md'],
    recursive: false,
  });

  for (const target of targets) {
    try {
      const s = await stat(target.path);

      if (s.isFile()) {
        // 단일 파일 (CLAUDE.md 등)
        const lineCount = await countLines(target.path);
        docs.push({
          name: basename(target.path),
          path: target.path,
          relativePath: relative(projectPath, target.path) || basename(target.path),
          category: target.category,
          sizeBytes: s.size,
          lineCount,
          lastModified: s.mtimeMs,
        });
      } else if (s.isDirectory()) {
        // 디렉토리 스캔
        const files = await collectFiles(target.path, target.extensions, target.recursive);
        const fileInfos = await Promise.all(
          files.map(async (filePath) => {
            const fileStat = await stat(filePath);
            const lineCount = await countLines(filePath);
            return {
              name: basename(filePath),
              path: filePath,
              relativePath: relative(projectPath, filePath),
              category: target.category,
              sizeBytes: fileStat.size,
              lineCount,
              lastModified: fileStat.mtimeMs,
            };
          })
        );
        docs.push(...fileInfos);
      }
    } catch {
      // 대상 없으면 스킵
    }
  }

  // 최종 수정일 역순 정렬
  docs.sort((a, b) => b.lastModified - a.lastModified);

  return docs;
}
