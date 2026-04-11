import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export interface LintRule {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

export interface LintSection {
  level: number;
  title: string;
  lineNumber: number;
  lineCount: number;
}

export interface ClaudeMdLintResult {
  filePath: string;
  exists: boolean;
  totalLines: number;
  totalBytes: number;
  sections: LintSection[];
  rules: LintRule[];
  score: number;
}

export interface ClaudeMdLinterOptions {
  projectPath?: string;
}

const MAX_RECOMMENDED_LINES = 200;
const MAX_SECTION_LINES = 50;

/**
 * CLAUDE.md 파일을 분석하여 린트 결과 반환
 */
export async function lintClaudeMd(
  projectPath: string,
  _options: ClaudeMdLinterOptions = {}
): Promise<ClaudeMdLintResult> {
  const filePath = join(projectPath, 'CLAUDE.md');

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return {
      filePath,
      exists: false,
      totalLines: 0,
      totalBytes: 0,
      sections: [],
      rules: [
        {
          id: 'missing-file',
          severity: 'error',
          message: 'CLAUDE.md 파일이 없습니다',
          suggestion: '프로젝트 루트에 CLAUDE.md 파일을 생성하세요',
        },
      ],
      score: 0,
    };
  }

  const lines = content.split(/\r?\n/);
  const totalLines = lines.length;
  const totalBytes = Buffer.byteLength(content, 'utf-8');
  const rules: LintRule[] = [];
  const sections: LintSection[] = [];

  // 섹션 파싱
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,4})\s+(.+)/);
    if (match) {
      sections.push({
        level: match[1].length,
        title: match[2].trim(),
        lineNumber: i + 1,
        lineCount: 0,
      });
    }
  }

  // 섹션별 라인 수 계산
  for (let i = 0; i < sections.length; i++) {
    const nextStart = i + 1 < sections.length ? sections[i + 1].lineNumber : totalLines + 1;
    sections[i].lineCount = nextStart - sections[i].lineNumber;
  }

  // ─── 구조 규칙 ───

  if (totalLines === 0) {
    rules.push({
      id: 'empty-file',
      severity: 'error',
      message: 'CLAUDE.md 파일이 비어있습니다',
      suggestion: '프로젝트 개요, 기술 스택, 코딩 컨벤션을 작성하세요',
    });
  }

  if (totalLines > MAX_RECOMMENDED_LINES) {
    rules.push({
      id: 'too-long',
      severity: 'warning',
      message: `CLAUDE.md가 ${totalLines}줄입니다 (권장: ${MAX_RECOMMENDED_LINES}줄 이하)`,
      suggestion:
        '파일을 분리하거나 .claude/rules/*.md로 세부 규칙을 이동하세요',
    });
  }

  if (sections.length === 0 && totalLines > 0) {
    rules.push({
      id: 'no-sections',
      severity: 'warning',
      message: '마크다운 헤딩(#)이 없습니다',
      suggestion: '섹션 구조를 추가하여 가독성을 높이세요',
    });
  }

  // 과도하게 긴 섹션
  for (const section of sections) {
    if (section.lineCount > MAX_SECTION_LINES) {
      rules.push({
        id: 'long-section',
        severity: 'info',
        message: `"${section.title}" 섹션이 ${section.lineCount}줄입니다 (권장: ${MAX_SECTION_LINES}줄 이하)`,
        suggestion: '하위 섹션으로 분할하거나 별도 파일로 분리하세요',
      });
    }
  }

  // ─── 완전성 규칙 ───

  const contentLower = content.toLowerCase();

  const recommendedKeywords = [
    { keyword: '기술 스택', alt: 'tech stack', id: 'missing-tech-stack', label: '기술 스택' },
    { keyword: '코딩 컨벤션', alt: 'coding convention', id: 'missing-conventions', label: '코딩 컨벤션' },
    { keyword: '프로젝트', alt: 'project', id: 'missing-overview', label: '프로젝트 개요' },
  ];

  for (const { keyword, alt, id, label } of recommendedKeywords) {
    if (!contentLower.includes(keyword) && !contentLower.includes(alt)) {
      rules.push({
        id,
        severity: 'info',
        message: `"${label}" 관련 내용이 없습니다`,
        suggestion: `${label} 섹션을 추가하면 Claude의 컨텍스트 이해가 향상됩니다`,
      });
    }
  }

  // ─── 보안 규칙 ───

  const sensitivePatterns = [
    { pattern: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]+['"]/gi, label: '시크릿/토큰' },
    { pattern: /(?:sk-|ghp_|gho_|github_pat_)[a-zA-Z0-9]{20,}/g, label: 'API 키' },
  ];

  for (const { pattern, label } of sensitivePatterns) {
    if (pattern.test(content)) {
      rules.push({
        id: 'secret-detected',
        severity: 'error',
        message: `${label}이 하드코딩되어 있을 수 있습니다`,
        suggestion: '환경 변수를 사용하고 CLAUDE.md에서 제거하세요',
      });
    }
  }

  // ─── 점수 계산 ───
  const errorCount = rules.filter((r) => r.severity === 'error').length;
  const warningCount = rules.filter((r) => r.severity === 'warning').length;
  const infoCount = rules.filter((r) => r.severity === 'info').length;

  let score = 100;
  score -= errorCount * 25;
  score -= warningCount * 10;
  score -= infoCount * 3;
  score = Math.max(0, Math.min(100, score));

  return {
    filePath,
    exists: true,
    totalLines,
    totalBytes,
    sections,
    rules,
    score,
  };
}

/**
 * 모든 프로젝트의 CLAUDE.md를 린트
 */
export async function lintAllProjects(): Promise<ClaudeMdLintResult[]> {
  const { readdir, stat } = await import('fs/promises');
  const projectsDir = join(homedir(), '.claude', 'projects');

  let dirs: string[];
  try {
    dirs = await readdir(projectsDir);
  } catch {
    return [];
  }

  const results: ClaudeMdLintResult[] = [];

  for (const dir of dirs) {
    const dirPath = join(projectsDir, dir);
    try {
      const s = await stat(dirPath);
      if (!s.isDirectory()) continue;
    } catch {
      continue;
    }

    // 인코딩된 디렉토리명에서 원본 경로 복원은 어려우므로,
    // 현재 프로젝트(process.cwd())만 린트
  }

  // 현재 프로젝트 린트
  const cwd = process.cwd();
  results.push(await lintClaudeMd(cwd));

  return results;
}
