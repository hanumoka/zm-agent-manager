import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { FileText, Pencil, Eye, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react';
import type { JsonlRecord, FileVersionInfo } from '@shared/types';
import { FileDiffView } from './FileDiffView';

// ─── 타입 ───

interface FileChange {
  filePath: string;
  fileName: string;
  writes: number;
  edits: number;
  reads: number;
  total: number;
}

// ─── 파일 변경 추출 ───

function extractFileChanges(records: JsonlRecord[]): FileChange[] {
  const fileMap = new Map<string, { writes: number; edits: number; reads: number }>();

  for (const record of records) {
    if (record.type !== 'assistant') continue;
    if (!record.message?.content) continue;

    for (const block of record.message.content) {
      if (block.type !== 'tool_use') continue;
      const input = block.input as Record<string, unknown>;
      const filePath = input.file_path as string | undefined;
      if (!filePath) continue;

      const existing = fileMap.get(filePath) ?? { writes: 0, edits: 0, reads: 0 };

      if (block.name === 'Write') existing.writes++;
      else if (block.name === 'Edit') existing.edits++;
      else if (block.name === 'Read') existing.reads++;
      else continue;

      fileMap.set(filePath, existing);
    }
  }

  return [...fileMap.entries()]
    .map(([filePath, counts]) => ({
      filePath,
      fileName: filePath.split(/[\\/]/).pop() ?? filePath,
      ...counts,
      total: counts.writes + counts.edits + counts.reads,
    }))
    .sort((a, b) => b.edits + b.writes - (a.edits + a.writes));
}

// ─── FileRow ───

interface FileRowProps {
  file: FileChange;
  isExpanded: boolean;
  onToggle: () => void;
  sessionId: string;
  projectEncoded: string;
}

function FileRow({
  file,
  isExpanded,
  onToggle,
  sessionId,
  projectEncoded,
}: FileRowProps): React.JSX.Element {
  const [versions, setVersions] = useState<FileVersionInfo | null>(null);
  const [fromVersion, setFromVersion] = useState<number | null>(null);
  const [toVersion, setToVersion] = useState<number | null>(null);
  const [fromContent, setFromContent] = useState<string | null>(null);
  const [toContent, setToContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 확장 시 버전 목록 로드
  useEffect(() => {
    if (!isExpanded || versions || !sessionId || !projectEncoded) return;
    setLoading(true);
    window.api
      ?.getFileVersions?.(sessionId, projectEncoded)
      ?.then((allVersions) => {
        if (!isMountedRef.current) return;
        // 이 파일의 경로와 매칭 (Windows/Unix 경로 정규화)
        const normalizedPath = file.filePath.replace(/\\/g, '/');
        const match = allVersions.find(
          (v) => v.filePath.replace(/\\/g, '/') === normalizedPath
        );
        if (match && match.versions.length > 0) {
          setVersions(match);
          // 기본 선택: 첫 버전과 마지막 버전
          if (match.versions.length === 1) {
            setFromVersion(null); // 파일 생성 전
            setToVersion(match.versions[0].version);
          } else {
            setFromVersion(match.versions[0].version);
            setToVersion(match.versions[match.versions.length - 1].version);
          }
        }
        setLoading(false);
      })
      ?.catch(() => {
        if (isMountedRef.current) setLoading(false);
      });
  }, [isExpanded, versions, sessionId, projectEncoded, file.filePath]);

  // 버전 변경 시 내용 로드
  useEffect(() => {
    if (!versions || toVersion === null) return;

    const loadContent = async (): Promise<void> => {
      // from
      if (fromVersion === null) {
        setFromContent(null);
      } else {
        const fromInfo = versions.versions.find((v) => v.version === fromVersion);
        if (fromInfo?.backupFileName) {
          const content = await window.api?.getFileContent?.(sessionId, fromInfo.backupFileName);
          if (isMountedRef.current) setFromContent(content ?? null);
        } else {
          if (isMountedRef.current) setFromContent(null);
        }
      }

      // to
      const toInfo = versions.versions.find((v) => v.version === toVersion);
      if (toInfo?.backupFileName) {
        const content = await window.api?.getFileContent?.(sessionId, toInfo.backupFileName);
        if (isMountedRef.current) setToContent(content ?? '');
      } else {
        if (isMountedRef.current) setToContent('');
      }
    };

    loadContent();
  }, [versions, fromVersion, toVersion, sessionId]);

  return (
    <div>
      <div
        className="flex items-center gap-3 px-3 py-2 hover:bg-accent/30 transition-colors rounded-md cursor-pointer"
        onClick={onToggle}
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{file.fileName}</p>
          <p className="text-xs text-muted-foreground truncate">{file.filePath}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs">
          {file.writes > 0 && (
            <span className="flex items-center gap-1 text-green-400">
              <FileText className="h-3 w-3" />
              {file.writes}
            </span>
          )}
          {file.edits > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              <Pencil className="h-3 w-3" />
              {file.edits}
            </span>
          )}
          {file.reads > 0 && (
            <span className="flex items-center gap-1 text-blue-400">
              <Eye className="h-3 w-3" />
              {file.reads}
            </span>
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="ml-10 mr-3 mb-3 mt-1">
          {loading ? (
            <p className="text-xs text-muted-foreground">버전 로딩 중...</p>
          ) : !versions || versions.versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">파일 히스토리가 없습니다</p>
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
                  filePath={file.filePath}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── FileChangePanel ───

interface FileChangePanelProps {
  records: JsonlRecord[];
  sessionId?: string;
  projectEncoded?: string;
}

export function FileChangePanel({
  records,
  sessionId = '',
  projectEncoded = '',
}: FileChangePanelProps): React.JSX.Element {
  const files = useMemo(() => extractFileChanges(records), [records]);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const handleToggle = useCallback((filePath: string) => {
    setExpandedFile((prev) => (prev === filePath ? null : filePath));
  }, []);

  const stats = useMemo(() => {
    const totalEdits = files.reduce((acc, f) => acc + f.edits, 0);
    const totalWrites = files.reduce((acc, f) => acc + f.writes, 0);
    const totalReads = files.reduce((acc, f) => acc + f.reads, 0);
    const modifiedFiles = files.filter((f) => f.writes > 0 || f.edits > 0).length;
    return { uniqueFiles: files.length, modifiedFiles, totalEdits, totalWrites, totalReads };
  }, [files]);

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        파일 변경 기록이 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 overflow-y-auto h-full">
      {/* 요약 */}
      <div className="flex gap-4">
        <div className="rounded-lg border border-border bg-card p-3 flex-1">
          <p className="text-xs text-muted-foreground">수정된 파일</p>
          <p className="text-2xl font-bold text-foreground">{stats.modifiedFiles}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 flex-1">
          <p className="text-xs text-muted-foreground">총 파일</p>
          <p className="text-2xl font-bold text-foreground">{stats.uniqueFiles}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 flex-1">
          <p className="text-xs text-muted-foreground">Edit 호출</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.totalEdits}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 flex-1">
          <p className="text-xs text-muted-foreground">Write 호출</p>
          <p className="text-2xl font-bold text-green-400">{stats.totalWrites}</p>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3 text-green-400" /> Write
        </span>
        <span className="flex items-center gap-1">
          <Pencil className="h-3 w-3 text-yellow-400" /> Edit
        </span>
        <span className="flex items-center gap-1">
          <Eye className="h-3 w-3 text-blue-400" /> Read
        </span>
        <span className="ml-auto text-[10px]">파일 클릭 시 diff 표시</span>
      </div>

      {/* 파일 목록 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">파일별 변경 ({files.length}개)</h3>
        </div>
        <div className="divide-y divide-border/50">
          {files.map((file) => (
            <FileRow
              key={file.filePath}
              file={file}
              isExpanded={expandedFile === file.filePath}
              onToggle={() => handleToggle(file.filePath)}
              sessionId={sessionId}
              projectEncoded={projectEncoded}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
