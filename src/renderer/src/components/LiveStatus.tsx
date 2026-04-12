import { useEffect, useState } from 'react';

interface LiveStatusProps {
  /** 마지막 갱신 시각(ms). `null`이면 "갱신 대기 중" */
  lastUpdatedAt: number | null;
  /** 폴링 주기(ms) — 툴팁에 안내 표시. 없으면 생략 */
  intervalMs?: number;
  /** `false`면 회색 dot ("일시정지") */
  isLive?: boolean;
}

/**
 * 페이지 헤더에 표시하는 실시간 갱신 상태 컴포넌트.
 *
 * - 초록 dot + "실시간 · HH:MM:SS 갱신 (Xs 전)"
 * - 1초 간격 `setInterval`로 "X초 전" 라벨만 로컬에서 재계산 (부모 리렌더 불필요)
 * - 언마운트 시 interval 정리
 */
export function LiveStatus({
  lastUpdatedAt,
  intervalMs,
  isLive = true,
}: LiveStatusProps): React.JSX.Element {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (lastUpdatedAt === null) {
    return (
      <div
        data-testid="live-status"
        className="flex items-center gap-2 text-xs text-muted-foreground"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />
        <span>갱신 대기 중</span>
      </div>
    );
  }

  const d = new Date(lastUpdatedAt);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const diffSec = Math.max(0, Math.round((now - lastUpdatedAt) / 1000));
  const relative = diffSec < 1 ? '방금' : `${diffSec}s 전`;

  const dotClass = isLive
    ? 'bg-accent-green animate-pulse'
    : 'bg-muted-foreground/40';

  const tooltip = intervalMs
    ? `${Math.round(intervalMs / 1000)}s 주기로 자동 갱신`
    : undefined;

  return (
    <div
      data-testid="live-status"
      className="flex items-center gap-2 text-xs text-muted-foreground"
      title={tooltip}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
      <span>{isLive ? '실시간' : '일시정지'}</span>
      <span>·</span>
      <span className="font-mono">
        {hh}:{mm}:{ss}
      </span>
      <span data-testid="live-status-relative" className="text-muted-foreground/70">
        ({relative})
      </span>
    </div>
  );
}
