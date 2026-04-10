import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brain, AlertTriangle, Search } from 'lucide-react';
import { useSessionStore } from '@/stores/session-store';
import { encodeProjectPath } from '@shared/types';
import type { MemoryContent } from '@shared/types';

// ─── 포맷 ───

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// ─── HighlightedLine ───

function HighlightedLine({ line, query }: { line: string; query: string }): React.JSX.Element {
  if (!query) return <span>{line}</span>;
  const lowerLine = line.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: { text: string; hl: boolean }[] = [];
  let lastIdx = 0;
  let idx = lowerLine.indexOf(lowerQuery);
  while (idx !== -1) {
    if (idx > lastIdx) parts.push({ text: line.slice(lastIdx, idx), hl: false });
    parts.push({ text: line.slice(idx, idx + query.length), hl: true });
    lastIdx = idx + query.length;
    idx = lowerLine.indexOf(lowerQuery, lastIdx);
  }
  if (lastIdx < line.length) parts.push({ text: line.slice(lastIdx), hl: false });
  if (parts.length === 0) return <span>{line}</span>;
  return (
    <span>
      {parts.map((p, i) =>
        p.hl ? (
          <mark key={i} className="bg-accent-yellow/40 text-foreground rounded px-0.5">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </span>
  );
}

// ─── MemoryPage ───

export function MemoryPage(): React.JSX.Element {
  const { groups, fetchSessions } = useSessionStore();
  const [selectedProject, setSelectedProject] = useState('');
  const [memory, setMemory] = useState<MemoryContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (groups.length === 0) fetchSessions();
  }, [groups.length, fetchSessions]);

  // 프로젝트 목록
  const projects = useMemo(
    () =>
      groups.map((g) => ({
        name: g.projectName,
        path: g.projectPath,
        encoded: encodeProjectPath(g.projectPath),
      })),
    [groups]
  );

  // 프로젝트 1개만 있으면 자동 선택
  useEffect(() => {
    if (projects.length === 1 && !selectedProject) {
      setSelectedProject(projects[0].encoded);
    }
  }, [projects, selectedProject]);

  // 선택 시 로드
  const loadMemory = useCallback(async (encoded: string) => {
    if (!encoded) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.api?.getMemoryContent?.(encoded);
      if (!result) throw new Error('preload API를 사용할 수 없습니다');
      if (isMountedRef.current) setMemory(result);
    } catch (err) {
      if (isMountedRef.current) setError(err instanceof Error ? err.message : '메모리 로드 실패');
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProject) loadMemory(selectedProject);
  }, [selectedProject, loadMemory]);

  // 검색 결과 라인 필터
  const filteredLines = useMemo(() => {
    if (!memory?.content) return [];
    const lines = memory.content.split('\n');
    if (!searchQuery.trim()) return lines;
    const lower = searchQuery.toLowerCase();
    return lines.filter((l) => l.toLowerCase().includes(lower));
  }, [memory?.content, searchQuery]);

  const matchCount = useMemo(() => {
    if (!searchQuery.trim() || !memory?.content) return 0;
    return filteredLines.length;
  }, [filteredLines, searchQuery, memory?.content]);

  return (
    <div className="flex h-full flex-col" data-testid="page-memory">
      {/* 헤더 */}
      <div className="border-b border-border px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-accent-green" />
          <h1 className="text-lg font-semibold text-foreground">메모리 뷰어</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            data-testid="memory-project-select"
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">— 프로젝트 선택 —</option>
            {projects.map((p) => (
              <option key={p.encoded} value={p.encoded}>
                {p.name}
              </option>
            ))}
          </select>
          {memory?.content && (
            <div className="flex items-center gap-1 flex-1">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="메모리 검색..."
                data-testid="memory-search"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {searchQuery && <span className="text-xs text-muted-foreground">{matchCount}줄</span>}
            </div>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto">
        {!selectedProject ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Brain className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">프로젝트를 선택하면 MEMORY.md 내용을 표시합니다</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="p-6 space-y-3">
            <div className="h-6 w-48 rounded bg-muted animate-pulse" />
            <div className="h-64 rounded-lg bg-muted animate-pulse" />
          </div>
        ) : error ? (
          <div className="p-6 text-destructive">
            <p>메모리를 불러올 수 없습니다: {error}</p>
          </div>
        ) : memory?.content === null ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Brain className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">이 프로젝트에 MEMORY.md 파일이 없습니다</p>
              <p className="text-xs mt-1">Claude Code가 자동 메모리를 저장하면 여기에 표시됩니다</p>
            </div>
          </div>
        ) : memory ? (
          <div className="p-4 space-y-3">
            {/* 메타 + 경고 */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{memory.lineCount}줄</span>
              <span>·</span>
              <span>{formatBytes(memory.sizeBytes)}</span>
              <span>·</span>
              <span className="font-mono truncate max-w-md">{memory.filePath}</span>
            </div>
            {memory.exceedsLimit && (
              <div
                className="flex items-center gap-2 rounded-md border border-accent-orange/30 bg-accent-orange/10 px-3 py-2 text-xs text-accent-orange"
                data-testid="memory-warning"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {memory.lineCount}줄 — Claude 시스템 프롬프트에서 200줄까지만 로드됩니다. 불필요한
                  항목을 정리하세요.
                </span>
              </div>
            )}
            {/* 내용 */}
            <div
              className="rounded-lg border border-border bg-card p-4 font-mono text-sm whitespace-pre-wrap leading-relaxed"
              data-testid="memory-content"
            >
              {filteredLines.map((line, i) => (
                <div key={i} className="min-h-[1.5em]">
                  {searchQuery ? (
                    <HighlightedLine line={line} query={searchQuery} />
                  ) : (
                    line || '\u00A0'
                  )}
                </div>
              ))}
              {searchQuery && filteredLines.length === 0 && (
                <div className="text-muted-foreground text-center py-4">검색 결과가 없습니다</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
