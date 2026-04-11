import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronsLeft,
  ChevronsRight,
  FileText,
} from 'lucide-react';
import { MessageTimeline } from '@/components/MessageTimeline';
import type { JsonlRecord, FileHistorySnapshot, TrackedFileBackup } from '@shared/types';

const SPEEDS = [0.5, 1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

// 재생 간격 (ms) — speed에 따라 조정
function getInterval(speed: Speed): number {
  return Math.round(1000 / speed);
}

interface ReplayPlayerProps {
  records: JsonlRecord[];
  sessionId?: string;
}

/** records에서 file-history-snapshot 인덱스를 수집 */
function collectSnapshots(
  records: JsonlRecord[]
): { index: number; snapshot: FileHistorySnapshot }[] {
  const result: { index: number; snapshot: FileHistorySnapshot }[] = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.type === 'file-history-snapshot' && r.snapshot) {
      result.push({ index: i, snapshot: r.snapshot as FileHistorySnapshot });
    }
  }
  return result;
}

/** playhead 위치에 해당하는 최신 스냅샷의 trackedFileBackups 반환 */
function getFilesAtPlayhead(
  snapshots: { index: number; snapshot: FileHistorySnapshot }[],
  playheadRecordIndex: number
): Record<string, TrackedFileBackup> {
  // playhead 이전의 모든 스냅샷을 병합
  const merged: Record<string, TrackedFileBackup> = {};
  for (const s of snapshots) {
    if (s.index > playheadRecordIndex) break;
    for (const [filePath, backup] of Object.entries(s.snapshot.trackedFileBackups)) {
      merged[filePath] = backup;
    }
  }
  return merged;
}

export function ReplayPlayer({ records, sessionId = '' }: ReplayPlayerProps): React.JSX.Element {
  const [playheadIndex, setPlayheadIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // user/assistant 메시지만 필터
  const messages = useMemo(
    () => records.filter((r) => r.type === 'user' || r.type === 'assistant'),
    [records]
  );

  const maxIndex = messages.length;

  // 재생 로직
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setPlayheadIndex((prev) => {
          if (prev >= maxIndex) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, getInterval(speed));
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, speed, maxIndex]);

  // 플레이헤드까지의 메시지만 전달
  const visibleRecords = useMemo(() => messages.slice(0, playheadIndex), [messages, playheadIndex]);

  const togglePlay = useCallback(() => {
    if (playheadIndex >= maxIndex) {
      setPlayheadIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  }, [playheadIndex, maxIndex]);

  const stepBack = useCallback(() => {
    setIsPlaying(false);
    setPlayheadIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const stepForward = useCallback(() => {
    setIsPlaying(false);
    setPlayheadIndex((prev) => Math.min(maxIndex, prev + 1));
  }, [maxIndex]);

  const goToStart = useCallback(() => {
    setIsPlaying(false);
    setPlayheadIndex(0);
  }, []);

  const goToEnd = useCallback(() => {
    setIsPlaying(false);
    setPlayheadIndex(maxIndex);
  }, [maxIndex]);

  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      const idx = SPEEDS.indexOf(prev);
      return SPEEDS[(idx + 1) % SPEEDS.length];
    });
  }, []);

  // file-history-snapshot 추적
  const snapshots = useMemo(() => collectSnapshots(records), [records]);

  // playhead에 해당하는 레코드 인덱스 (messages → records 인덱스 변환)
  const playheadRecordIndex = useMemo(() => {
    if (playheadIndex === 0) return -1;
    const msg = messages[playheadIndex - 1];
    if (!msg) return -1;
    return records.indexOf(msg);
  }, [playheadIndex, messages, records]);

  const trackedFiles = useMemo(
    () => getFilesAtPlayhead(snapshots, playheadRecordIndex),
    [snapshots, playheadRecordIndex]
  );

  const trackedFileEntries = useMemo(
    () =>
      Object.entries(trackedFiles).sort((a, b) => a[0].localeCompare(b[0])),
    [trackedFiles]
  );

  const [showFiles, setShowFiles] = useState(false);
  const [viewingContent, setViewingContent] = useState<string | null>(null);
  const [viewingFilePath, setViewingFilePath] = useState<string>('');

  const handleViewFile = useCallback(
    async (filePath: string, backupFileName: string | null) => {
      if (!backupFileName || !sessionId) return;
      const content = await window.api?.getFileContent?.(sessionId, backupFileName);
      setViewingContent(content ?? '(내용을 읽을 수 없습니다)');
      setViewingFilePath(filePath);
    },
    [sessionId]
  );

  const progress = maxIndex > 0 ? (playheadIndex / maxIndex) * 100 : 0;

  return (
    <div className="flex h-full flex-col">
      {/* 컨트롤 바 */}
      <div className="border-b border-border px-4 py-2 space-y-2">
        {/* 진행 바 */}
        <div
          className="relative h-2 rounded-full bg-secondary cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            setPlayheadIndex(Math.round(fraction * maxIndex));
            setIsPlaying(false);
          }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-primary border-2 border-background shadow-md transition-all duration-100"
            style={{ left: `calc(${progress}% - 8px)` }}
          />
        </div>

        {/* 버튼 + 정보 */}
        <div className="flex items-center gap-2">
          <button onClick={goToStart} className="rounded p-1 hover:bg-accent transition-colors">
            <ChevronsLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={stepBack} className="rounded p-1 hover:bg-accent transition-colors">
            <SkipBack className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={togglePlay}
            className="rounded-md p-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button onClick={stepForward} className="rounded p-1 hover:bg-accent transition-colors">
            <SkipForward className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={goToEnd} className="rounded p-1 hover:bg-accent transition-colors">
            <ChevronsRight className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* 속도 */}
          <button
            onClick={cycleSpeed}
            className="rounded-md px-2 py-1 text-xs font-mono font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            {speed}x
          </button>

          <div className="flex-1" />

          {/* 진행 상태 */}
          {trackedFileEntries.length > 0 && (
            <button
              onClick={() => {
                setShowFiles((p) => !p);
                setViewingContent(null);
              }}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                showFiles ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              <FileText className="h-3 w-3" />
              {trackedFileEntries.length} 파일
            </button>
          )}

          <span className="text-xs text-muted-foreground">
            {playheadIndex} / {maxIndex} 메시지
          </span>
        </div>
      </div>

      {/* 메시지 + 파일 영역 */}
      <div className="flex flex-1 min-h-0">
        <div className={`${showFiles ? 'flex-1' : 'w-full'} min-h-0`}>
          {playheadIndex === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="text-sm">재생 버튼을 눌러 세션을 리플레이하세요</p>
            </div>
          ) : (
            <MessageTimeline records={visibleRecords} />
          )}
        </div>
        {showFiles && (
          <div className="w-80 border-l border-border overflow-y-auto p-3 space-y-2">
            <h3 className="text-xs font-semibold text-foreground">
              이 시점의 추적 파일 ({trackedFileEntries.length})
            </h3>
            {trackedFileEntries.map(([filePath, backup]) => {
              const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
              return (
                <div
                  key={filePath}
                  className="rounded border border-border/50 px-2 py-1.5 text-xs cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => handleViewFile(filePath, backup.backupFileName)}
                >
                  <p className="font-medium text-foreground truncate">{fileName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    v{backup.version} · {new Date(backup.backupTime).toLocaleTimeString()}
                  </p>
                </div>
              );
            })}
            {viewingContent !== null && (
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground truncate">
                    {viewingFilePath.split(/[\\/]/).pop()}
                  </p>
                  <button
                    onClick={() => setViewingContent(null)}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    닫기
                  </button>
                </div>
                <pre className="max-h-64 overflow-auto rounded border border-border/50 bg-background p-2 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                  {viewingContent}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
