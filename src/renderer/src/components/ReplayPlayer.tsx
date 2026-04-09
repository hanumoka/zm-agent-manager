import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { MessageTimeline } from '@/components/MessageTimeline';
import type { JsonlRecord } from '@shared/types';

const SPEEDS = [0.5, 1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

// 재생 간격 (ms) — speed에 따라 조정
function getInterval(speed: Speed): number {
  return Math.round(1000 / speed);
}

interface ReplayPlayerProps {
  records: JsonlRecord[];
}

export function ReplayPlayer({ records }: ReplayPlayerProps): React.JSX.Element {
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
          <span className="text-xs text-muted-foreground">
            {playheadIndex} / {maxIndex} 메시지
          </span>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 min-h-0">
        {playheadIndex === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">재생 버튼을 눌러 세션을 리플레이하세요</p>
          </div>
        ) : (
          <MessageTimeline records={visibleRecords} />
        )}
      </div>
    </div>
  );
}
