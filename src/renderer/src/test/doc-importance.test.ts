import { describe, it, expect } from 'vitest';
import { classifyDocImportance } from '@/lib/doc-importance';

describe('classifyDocImportance', () => {
  it('docs/requirements/ → blocking', () => {
    expect(classifyDocImportance('docs/requirements/PRD-v2.md')).toBe('blocking');
    expect(classifyDocImportance('docs/requirements/feature-spec.md')).toBe('blocking');
  });

  it('PRD*.md (루트) → blocking', () => {
    expect(classifyDocImportance('PRD.md')).toBe('blocking');
    expect(classifyDocImportance('PRD-v2.md')).toBe('blocking');
  });

  it('대소문자 무시 — prd-v2.md → blocking', () => {
    expect(classifyDocImportance('prd-v2.md')).toBe('blocking');
  });

  it('docs/policies/ → important', () => {
    expect(classifyDocImportance('docs/policies/coding-conventions.md')).toBe('important');
  });

  it('CLAUDE.md → important', () => {
    expect(classifyDocImportance('CLAUDE.md')).toBe('important');
    expect(classifyDocImportance('some/path/CLAUDE.md')).toBe('important');
  });

  it('.claude/rules/ → important', () => {
    expect(classifyDocImportance('.claude/rules/my-rule.md')).toBe('important');
  });

  it('docs/roadmap/ → important', () => {
    expect(classifyDocImportance('docs/roadmap/ROADMAP.md')).toBe('important');
    expect(classifyDocImportance('docs/roadmap/phase-3-analysis.md')).toBe('important');
  });

  it('MEMORY.md → important', () => {
    expect(classifyDocImportance('MEMORY.md')).toBe('important');
    expect(classifyDocImportance('../../.claude/projects/xxx/memory/MEMORY.md')).toBe('important');
  });

  it('docs/sessions/ → suggestion (기본)', () => {
    expect(classifyDocImportance('docs/sessions/SESSION_LOG.md')).toBe('suggestion');
  });

  it('docs/ideas/ → suggestion', () => {
    expect(classifyDocImportance('docs/ideas/INBOX.md')).toBe('suggestion');
  });

  it('기타 경로 → suggestion', () => {
    expect(classifyDocImportance('random/file.md')).toBe('suggestion');
    expect(classifyDocImportance('src/main/ipc.ts')).toBe('suggestion');
  });

  it('blocking이 important보다 우선 — docs/requirements/PRD 경로', () => {
    // docs/requirements/ 규칙이 먼저 매칭
    expect(classifyDocImportance('docs/requirements/PRD-v2.md')).toBe('blocking');
  });
});
