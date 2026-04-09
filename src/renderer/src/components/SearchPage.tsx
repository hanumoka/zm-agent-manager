import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Bot, Wrench } from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils';
import { encodeProjectPath } from '@shared/types';
import type { SearchResult, SearchResponse } from '@shared/types';

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

export function SearchPage(): React.JSX.Element {
  const [query, setQuery] = useState('');
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

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;

      setIsSearching(true);
      setError(null);
      try {
        const result = await window.api.searchSessions(trimmed);
        if (isMountedRef.current) setResponse(result);
      } catch (err) {
        if (isMountedRef.current) setError(err instanceof Error ? err.message : '검색 실패');
      } finally {
        if (isMountedRef.current) setIsSearching(false);
      }
    },
    [query]
  );

  const handleSelect = (result: SearchResult): void => {
    const encoded = encodeProjectPath(result.projectPath);
    navigate(`/timeline/${encoded}/${result.sessionId}`);
  };

  return (
    <div className="flex h-full flex-col" data-testid="page-search">
      {/* 검색 바 */}
      <div className="border-b border-border px-4 py-3">
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
