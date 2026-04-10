import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Bot, Wrench } from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils';
import { encodeProjectPath } from '@shared/types';
import type { SearchResult, SearchResponse, SearchFilters } from '@shared/types';
import { useSessionStore } from '@/stores/session-store';

// ─── 하이라이트 ───

function HighlightedText({ text, query }: { text: string; query: string }): React.JSX.Element {
  if (!query) return <span>{text}</span>;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: { text: string; highlight: boolean }[] = [];
  let lastIdx = 0;
  let idx = lowerText.indexOf(lowerQuery);

  while (idx !== -1) {
    if (idx > lastIdx) parts.push({ text: text.slice(lastIdx, idx), highlight: false });
    parts.push({ text: text.slice(idx, idx + query.length), highlight: true });
    lastIdx = idx + query.length;
    idx = lowerText.indexOf(lowerQuery, lastIdx);
  }
  if (lastIdx < text.length) parts.push({ text: text.slice(lastIdx), highlight: false });

  return (
    <span>
      {parts.map((p, i) =>
        p.highlight ? (
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

// ─── ResultItem ───

interface ResultItemProps {
  result: SearchResult;
  query: string;
  onSelect: (r: SearchResult) => void;
}

function ResultItem({ result, query, onSelect }: ResultItemProps): React.JSX.Element {
  const Icon = result.toolName ? Wrench : result.recordType === 'user' ? User : Bot;
  const iconColor = result.toolName
    ? 'text-accent-orange'
    : result.recordType === 'user'
      ? 'text-primary'
      : 'text-accent-green';

  return (
    <button
      onClick={() => onSelect(result)}
      className="flex items-start gap-3 w-full rounded-md px-3 py-3 text-left hover:bg-accent/30 transition-colors border-b border-border/50"
    >
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${iconColor}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-foreground">{result.projectName}</span>
          <span className="text-xs text-muted-foreground font-mono">
            {result.sessionId.slice(0, 8)}
          </span>
          {result.toolName && (
            <span className="text-xs text-accent-orange font-mono">{result.toolName}</span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {formatTimeAgo(result.timestamp)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
          <HighlightedText text={result.matchText} query={query} />
        </p>
      </div>
    </button>
  );
}

// ─── SearchPage ───

/** YYYY-MM-DD 입력을 해당 일자의 epoch ms(로컬)로 변환. 빈 값이면 undefined. */
function dateInputToMs(value: string, endOfDay = false): number | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const date = endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
  return date.getTime();
}

export function SearchPage(): React.JSX.Element {
  const { groups, fetchSessions } = useSessionStore();
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 프로젝트 드롭다운 옵션은 세션 스토어에서 추출
  useEffect(() => {
    if (groups.length === 0) fetchSessions();
  }, [groups.length, fetchSessions]);

  const projectOptions = useMemo(
    () =>
      Array.from(new Set(groups.map((g) => g.projectName)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [groups]
  );

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;

      const filters: SearchFilters = {};
      if (projectFilter) filters.projectName = projectFilter;
      const fromMs = dateInputToMs(dateFrom, false);
      const toMs = dateInputToMs(dateTo, true);
      if (fromMs !== undefined) filters.dateFromMs = fromMs;
      if (toMs !== undefined) filters.dateToMs = toMs;

      setIsSearching(true);
      setError(null);
      try {
        const result = await window.api?.searchSessions?.(trimmed, filters);
        if (!result) throw new Error('preload API를 사용할 수 없습니다');
        if (isMountedRef.current) setResponse(result);
      } catch (err) {
        if (isMountedRef.current) setError(err instanceof Error ? err.message : '검색 실패');
      } finally {
        if (isMountedRef.current) setIsSearching(false);
      }
    },
    [query, projectFilter, dateFrom, dateTo]
  );

  const handleSelect = (result: SearchResult): void => {
    const encoded = encodeProjectPath(result.projectPath);
    navigate(`/timeline/${encoded}/${result.sessionId}`);
  };

  return (
    <div className="flex h-full flex-col" data-testid="page-search">
      {/* 검색 바 + 필터 */}
      <div className="border-b border-border px-4 py-3 space-y-2">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="모든 세션에서 검색 (메시지, 도구 호출)..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          {response && (
            <span className="text-xs text-muted-foreground">{response.totalMatches}개 결과</span>
          )}
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="rounded-md px-3 py-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isSearching ? '검색 중...' : '검색'}
          </button>
        </form>
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <label className="flex items-center gap-1">
            프로젝트
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              data-testid="search-filter-project"
              className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
            >
              <option value="">전체</option>
              {projectOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            기간
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              data-testid="search-filter-from"
              className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
            />
            <span>~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              data-testid="search-filter-to"
              className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
            />
          </label>
          {(projectFilter || dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setProjectFilter('');
                setDateFrom('');
                setDateTo('');
              }}
              className="rounded-md px-2 py-1 text-xs hover:bg-accent/30 transition-colors"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* 결과 */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="p-4 text-destructive">
            <p>검색 오류: {error}</p>
          </div>
        )}

        {!response && !isSearching && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Search className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">검색어를 입력하여 모든 세션에서 검색하세요</p>
              <p className="text-xs mt-1">메시지 텍스트와 도구 호출 내용을 검색합니다</p>
            </div>
          </div>
        )}

        {response && response.results.length === 0 && !isSearching && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>검색 결과가 없습니다</p>
          </div>
        )}

        {response && response.results.length > 0 && (
          <div className="p-2">
            {response.results.map((result, i) => (
              <ResultItem
                key={`${result.sessionId}-${i}`}
                result={result}
                query={response.query}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
