/**
 * 문서 중요도 자동 분류 (F15 MVP).
 * PRD-v2.md Section F15 경로 규칙 기반. 하드코딩.
 *
 * | 중요도 | 경로 패턴 |
 * |--------|----------|
 * | blocking | docs/requirements/*, PRD*.md |
 * | important | docs/policies/*, CLAUDE.md, .claude/rules/* |
 * | important | docs/roadmap/*, MEMORY.md |
 * | suggestion | docs/sessions/*, docs/ideas/*, 기타 |
 */

export type DocImportance = 'blocking' | 'important' | 'suggestion';

interface ImportanceRule {
  pattern: RegExp;
  importance: DocImportance;
}

const RULES: ImportanceRule[] = [
  // blocking (최상)
  { pattern: /docs\/requirements\//i, importance: 'blocking' },
  { pattern: /PRD[^/]*\.md$/i, importance: 'blocking' },
  // important (상)
  { pattern: /docs\/policies\//i, importance: 'important' },
  { pattern: /CLAUDE\.md$/i, importance: 'important' },
  { pattern: /\.claude\/rules\//i, importance: 'important' },
  // important (중)
  { pattern: /docs\/roadmap\//i, importance: 'important' },
  { pattern: /MEMORY\.md$/i, importance: 'important' },
  // 나머지는 suggestion
];

/**
 * 문서의 상대 경로(또는 절대 경로)로 중요도를 판단한다.
 * 첫 매칭 규칙의 중요도를 반환. 매칭 없으면 'suggestion'.
 */
export function classifyDocImportance(path: string): DocImportance {
  for (const rule of RULES) {
    if (rule.pattern.test(path)) return rule.importance;
  }
  return 'suggestion';
}

export const IMPORTANCE_CONFIG: Record<
  DocImportance,
  { label: string; color: string; icon: string }
> = {
  blocking: { label: 'Blocking', color: 'text-destructive bg-destructive/10', icon: '🔴' },
  important: { label: 'Important', color: 'text-accent-orange bg-accent-orange/10', icon: '🟠' },
  suggestion: { label: 'Suggestion', color: 'text-muted-foreground bg-muted', icon: '⚪' },
};
