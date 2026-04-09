import { useMemo } from 'react';
import { FileText, Pencil, Eye, FolderOpen } from 'lucide-react';
import type { JsonlRecord } from '@shared/types';

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
      fileName: filePath.split('/').pop() ?? filePath,
      ...counts,
      total: counts.writes + counts.edits + counts.reads,
    }))
    .sort((a, b) => b.edits + b.writes - (a.edits + a.writes));
}

// ─── FileRow ───

function FileRow({ file }: { file: FileChange }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-accent/30 transition-colors rounded-md">
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
  );
}

// ─── FileChangePanel ───

interface FileChangePanelProps {
  records: JsonlRecord[];
}

export function FileChangePanel({ records }: FileChangePanelProps): React.JSX.Element {
  const files = useMemo(() => extractFileChanges(records), [records]);

  const stats = useMemo(() => {
    const totalEdits = files.reduce((acc, f) => acc + f.edits, 0);
    const totalWrites = files.reduce((acc, f) => acc + f.writes, 0);
    const totalReads = files.reduce((acc, f) => acc + f.reads, 0);
    // 수정된 파일 (Write 또는 Edit이 1회 이상)
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
      </div>

      {/* 파일 목록 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">파일별 변경 ({files.length}개)</h3>
        </div>
        <div className="divide-y divide-border/50">
          {files.map((file) => (
            <FileRow key={file.filePath} file={file} />
          ))}
        </div>
      </div>
    </div>
  );
}
