import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, FolderOpen, Check, X, MessageCircle, History } from 'lucide-react';
import { useSessionStore } from '@/stores/session-store';
import { formatTimeAgo } from '@/lib/utils';
import { classifyDocImportance, IMPORTANCE_CONFIG } from '@shared/doc-importance';
import { encodeProjectPath } from '@shared/types';
import type { DocInfo, DocReviewStatus, FileVersionInfo } from '@shared/types';
import { FileDiffView } from './FileDiffView';

// ─── 포맷 ───

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// ─── 카테고리 색상 ───

const CATEGORY_COLORS: Record<string, string> = {
  Config: 'bg-primary/20 text-primary',
  Rules: 'bg-accent-yellow/20 text-accent-yellow',
  Skills: 'bg-pink-500/20 text-pink-400',
  Agents: 'bg-cyan-500/20 text-cyan-400',
  Memory: 'bg-accent-green/20 text-accent-green',
  Docs: 'bg-accent-orange/20 text-accent-orange',
};

// ─── DocRow ───

// ─── 리뷰 상태 배지 + 토글 ───

const REVIEW_CONFIG: Record<
  DocReviewStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: {
    label: 'Pending',
    color: 'text-accent-yellow bg-accent-yellow/10',
    icon: MessageCircle,
  },
  approved: { label: 'Approved', color: 'text-accent-green bg-accent-green/10', icon: Check },
  rejected: { label: 'Rejected', color: 'text-destructive bg-destructive/10', icon: X },
  commented: { label: 'Commented', color: 'text-primary bg-primary/10', icon: MessageCircle },
};

/**
 * 단일 문서 행 — 중요도 배지 + 리뷰 상태 토글.
 */
const DocRow = memo(function DocRow({
  doc,
  sessionId,
  projectEncoded,
}: {
  doc: DocInfo;
  sessionId: string;
  projectEncoded: string;
}): React.JSX.Element {
  const categoryColor = CATEGORY_COLORS[doc.category] ?? 'bg-muted text-muted-foreground';
  const importance = classifyDocImportance(doc.relativePath || doc.path);
  const imp = IMPORTANCE_CONFIG[importance];
  const [reviewStatus, setReviewStatus] = useState<DocReviewStatus>('pending');
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<FileVersionInfo | null>(null);
  const [fromVersion, setFromVersion] = useState<number | null>(null);
  const [toVersion, setToVersion] = useState<number | null>(null);
  const [fromContent, setFromContent] = useState<string | null>(null);
  const [toContent, setToContent] = useState<string | null>(null);
  const historyLoadedRef = useRef(false);

  // 리뷰 상태 로드 (마운트 시 1회)
  useEffect(() => {
    let mounted = true;
    const docPath = doc.relativePath || doc.path;
    window.api?.getDocReview?.(docPath)?.then((r) => {
      if (mounted) setReviewStatus(r.status);
    });
    return () => {
      mounted = false;
    };
  }, [doc.relativePath, doc.path]);

  const handleReviewToggle = useCallback(async () => {
    const docPath = doc.relativePath || doc.path;
    // 순환: pending → approved → rejected → pending
    const nextMap: Record<DocReviewStatus, DocReviewStatus> = {
      pending: 'approved',
      approved: 'rejected',
      rejected: 'pending',
      commented: 'pending',
    };
    const next = nextMap[reviewStatus];
    try {
      const saved = await window.api?.setDocReview?.({
        docPath,
        status: next,
        updatedAt: Date.now(),
      });
      if (saved) setReviewStatus(saved.status);
    } catch {
      // 무음
    }
  }, [doc.relativePath, doc.path, reviewStatus]);

  // History 버전 로드
  useEffect(() => {
    if (!showHistory || historyLoadedRef.current || !sessionId) return;
    historyLoadedRef.current = true;
    window.api?.getFileVersions?.(sessionId, projectEncoded)?.then((allVersions) => {
      const normalizedDocPath = doc.path.replace(/\\/g, '/');
      const match = allVersions.find(
        (v) => v.filePath.replace(/\\/g, '/') === normalizedDocPath
      );
      if (match && match.versions.length > 0) {
        setVersions(match);
        if (match.versions.length === 1) {
          setFromVersion(null);
          setToVersion(match.versions[0].version);
        } else {
          setFromVersion(match.versions[0].version);
          setToVersion(match.versions[match.versions.length - 1].version);
        }
      }
    });
  }, [showHistory, sessionId, projectEncoded, doc.path]);

  // 버전 콘텐츠 로드
  useEffect(() => {
    if (!versions || toVersion === null || !sessionId) return;
    const load = async (): Promise<void> => {
      if (fromVersion === null) {
        setFromContent(null);
      } else {
        const fromInfo = versions.versions.find((v) => v.version === fromVersion);
        if (fromInfo?.backupFileName) {
          const c = await window.api?.getFileContent?.(sessionId, fromInfo.backupFileName);
          setFromContent(c ?? null);
        } else {
          setFromContent(null);
        }
      }
      const toInfo = versions.versions.find((v) => v.version === toVersion);
      if (toInfo?.backupFileName) {
        const c = await window.api?.getFileContent?.(sessionId, toInfo.backupFileName);
        setToContent(c ?? '');
      } else {
        setToContent('');
      }
    };
    load();
  }, [versions, fromVersion, toVersion, sessionId]);

  const review = REVIEW_CONFIG[reviewStatus];
  const ReviewIcon = review.icon;

  return (
    <>
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30 transition-colors rounded-md">
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{doc.name}</span>
          <span
            className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${categoryColor}`}
          >
            {doc.category}
          </span>
          {importance !== 'suggestion' && (
            <span
              className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${imp.color}`}
              title={`중요도: ${imp.label}`}
            >
              {imp.icon} {imp.label}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate" title={doc.relativePath}>
          {doc.relativePath?.replace(/^(\.\.[\\/])+/, '~/')}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
        {sessionId && (
          <button
            onClick={() => setShowHistory((p) => !p)}
            title="파일 히스토리"
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:opacity-80 ${
              showHistory ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            }`}
          >
            <History className="h-3 w-3" />
          </button>
        )}
        <button
          onClick={handleReviewToggle}
          title={`리뷰: ${review.label} (클릭하여 변경)`}
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:opacity-80 ${review.color}`}
        >
          <ReviewIcon className="h-3 w-3" />
          {review.label}
        </button>
        <span>{doc.lineCount}줄</span>
        <span>{formatBytes(doc.sizeBytes)}</span>
        <span className="w-20 text-right">{formatTimeAgo(doc.lastModified)}</span>
      </div>
    </div>
    {showHistory && (
      <div className="ml-7 mr-3 mb-2">
        {!versions || versions.versions.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">파일 히스토리가 없습니다</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">비교:</span>
              <select
                value={fromVersion ?? 'new'}
                onChange={(e) =>
                  setFromVersion(e.target.value === 'new' ? null : Number(e.target.value))
                }
                className="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground"
              >
                <option value="new">(생성 전)</option>
                {versions.versions.map((v) => (
                  <option key={v.version} value={v.version}>
                    v{v.version}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground">→</span>
              <select
                value={toVersion ?? ''}
                onChange={(e) => setToVersion(Number(e.target.value))}
                className="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground"
              >
                {versions.versions.map((v) => (
                  <option key={v.version} value={v.version}>
                    v{v.version}
                  </option>
                ))}
              </select>
            </div>
            {toContent !== null && (
              <FileDiffView
                fromContent={fromContent}
                toContent={toContent}
                filePath={doc.path}
              />
            )}
          </div>
        )}
      </div>
    )}
    </>
  );
});

// ─── DocInventory ───

export function DocInventory(): React.JSX.Element {
  const { groups, fetchSessions } = useSessionStore();
  const [docs, setDocs] = useState<DocInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('');

  // 프로젝트 목록 로드
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const projects = useMemo(
    () => groups.map((g) => ({ path: g.projectPath, name: g.projectName })),
    [groups]
  );

  // 첫 프로젝트 자동 선택
  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0].path);
    }
  }, [projects, selectedProject]);

  // 선택된 프로젝트의 문서 스캔
  useEffect(() => {
    if (!selectedProject) return;
    let isMounted = true;
    async function load(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const result = await window.api?.getProjectDocs?.(selectedProject);
        if (!result) throw new Error('preload API를 사용할 수 없습니다');
        if (isMounted) setDocs(result);
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : '문서 스캔 실패');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [selectedProject]);

  // 카테고리별 그룹핑
  const categories = useMemo(() => {
    const map = new Map<string, DocInfo[]>();
    for (const doc of docs) {
      const existing = map.get(doc.category) ?? [];
      existing.push(doc);
      map.set(doc.category, existing);
    }
    return [...map.entries()];
  }, [docs]);

  // 선택된 프로젝트의 최근 세션 ID + 인코딩 경로 (file-history 조회용)
  const { latestSessionId, selectedProjectEncoded } = useMemo(() => {
    const group = groups.find((g) => g.projectPath === selectedProject);
    if (!group || group.sessions.length === 0) return { latestSessionId: '', selectedProjectEncoded: '' };
    // sessions는 이미 최근 활동순 정렬
    return {
      latestSessionId: group.sessions[0].sessionId,
      selectedProjectEncoded: encodeProjectPath(group.projectPath),
    };
  }, [groups, selectedProject]);

  const stats = useMemo(() => {
    const totalLines = docs.reduce((acc, d) => acc + d.lineCount, 0);
    const totalSize = docs.reduce((acc, d) => acc + d.sizeBytes, 0);
    return { count: docs.length, totalLines, totalSize, categories: categories.length };
  }, [docs, categories]);

  if (isLoading && !selectedProject) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-10 w-48 rounded bg-muted animate-pulse" />
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="page-docs">
      {/* 헤더 */}
      <div className="flex items-center gap-4 border-b border-border px-4 py-3">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">문서 인벤토리</h2>
        <span className="text-xs text-muted-foreground">
          {stats.count}개 · {stats.totalLines.toLocaleString()}줄 · {formatBytes(stats.totalSize)}
        </span>
        <div className="flex-1" />

        {/* 프로젝트 선택 */}
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
        >
          {projects.map((p) => (
            <option key={p.path} value={p.path}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-destructive">
            <p>문서를 불러올 수 없습니다: {error}</p>
          </div>
        ) : docs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>이 프로젝트에서 관리 문서를 찾을 수 없습니다</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* StatCards */}
            <div className="flex gap-4">
              <div className="rounded-lg border border-border bg-card p-3 flex-1">
                <p className="text-xs text-muted-foreground">문서 수</p>
                <p className="text-2xl font-bold text-foreground">{stats.count}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 flex-1">
                <p className="text-xs text-muted-foreground">카테고리</p>
                <p className="text-2xl font-bold text-foreground">{stats.categories}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 flex-1">
                <p className="text-xs text-muted-foreground">총 라인</p>
                <p className="text-2xl font-bold text-foreground">
                  {stats.totalLines.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 flex-1">
                <p className="text-xs text-muted-foreground">총 크기</p>
                <p className="text-2xl font-bold text-foreground">{formatBytes(stats.totalSize)}</p>
              </div>
            </div>

            {/* 카테고리별 문서 목록 */}
            {categories.map(([category, categoryDocs]) => (
              <div key={category} className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  {category}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({categoryDocs.length}개)
                  </span>
                </h3>
                <div className="divide-y divide-border/50">
                  {categoryDocs.map((doc) => (
                    <DocRow
                      key={doc.path}
                      doc={doc}
                      sessionId={latestSessionId}
                      projectEncoded={selectedProjectEncoded}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
