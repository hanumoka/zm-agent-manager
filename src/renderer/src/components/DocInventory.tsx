import { useEffect, useMemo, useState } from 'react';
import { FileText, FolderOpen } from 'lucide-react';
import { useSessionStore } from '@/stores/session-store';
import { formatTimeAgo } from '@/lib/utils';
import type { DocInfo } from '@shared/types';

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

function DocRow({ doc }: { doc: DocInfo }): React.JSX.Element {
  const color = CATEGORY_COLORS[doc.category] ?? 'bg-muted text-muted-foreground';

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30 transition-colors rounded-md">
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{doc.name}</span>
          <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${color}`}>
            {doc.category}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{doc.relativePath}</p>
      </div>
      <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
        <span>{doc.lineCount}줄</span>
        <span>{formatBytes(doc.sizeBytes)}</span>
        <span className="w-20 text-right">{formatTimeAgo(doc.lastModified)}</span>
      </div>
    </div>
  );
}

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
        const result = await window.api.getProjectDocs(selectedProject);
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
                    <DocRow key={doc.path} doc={doc} />
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
