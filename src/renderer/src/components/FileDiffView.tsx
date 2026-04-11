import { useMemo } from 'react';
import { diffLines, type Change } from 'diff';

interface FileDiffViewProps {
  fromContent: string | null;
  toContent: string;
  filePath: string;
}

export function FileDiffView({ fromContent, toContent, filePath }: FileDiffViewProps): React.JSX.Element {
  const changes = useMemo<Change[]>(() => {
    return diffLines(fromContent ?? '', toContent);
  }, [fromContent, toContent]);

  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;

  // 통계
  const added = changes.filter((c) => c.added).reduce((s, c) => s + (c.count ?? 0), 0);
  const removed = changes.filter((c) => c.removed).reduce((s, c) => s + (c.count ?? 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground truncate" title={filePath}>
          {fileName}
        </p>
        <div className="flex items-center gap-2 text-xs">
          {added > 0 && <span className="text-green-400">+{added}</span>}
          {removed > 0 && <span className="text-red-400">-{removed}</span>}
        </div>
      </div>
      <div className="max-h-96 overflow-auto rounded border border-border/50 bg-background text-xs font-mono">
        {fromContent === null ? (
          <div className="p-2 text-muted-foreground">(새 파일)</div>
        ) : added === 0 && removed === 0 ? (
          <div className="p-2 text-muted-foreground">(변경 없음)</div>
        ) : null}
        {changes.map((change, i) => {
          const lines = change.value.split('\n');
          // 마지막 빈 줄 제거 (split 아티팩트)
          if (lines[lines.length - 1] === '') lines.pop();

          return lines.map((line, j) => (
            <div
              key={`${i}-${j}`}
              className={`px-2 py-0.5 whitespace-pre-wrap break-all ${
                change.added
                  ? 'bg-green-900/30 text-green-300'
                  : change.removed
                    ? 'bg-red-900/30 text-red-300'
                    : 'text-muted-foreground'
              }`}
            >
              <span className="inline-block w-4 select-none text-right opacity-50 mr-2">
                {change.added ? '+' : change.removed ? '-' : ' '}
              </span>
              {line || ' '}
            </div>
          ));
        })}
      </div>
    </div>
  );
}
