import { useEffect, useMemo, useState } from 'react';
import { GitCompare } from 'lucide-react';
import { useSessionStore } from '@/stores/session-store';
import { formatTimeAgo } from '@/lib/utils';
import type { SessionMeta } from '@shared/types';

/**
 * 세션 비교 페이지 (F10)
 *
 * 상단: 두 드롭다운으로 세션 A/B 선택
 * 중단: 선택된 두 세션의 통계 비교 (Commit 2)
 * 하단: 좌/우 병렬 MessageTimeline + 도구 호출 분포 (Commit 3)
 */

// ─── SessionSelector ───

interface SessionSelectorProps {
  label: string;
  sessions: SessionMeta[];
  value: string;
  onChange: (sessionKey: string) => void;
  testId: string;
}

function SessionSelector({
  label,
  sessions,
  value,
  onChange,
  testId,
}: SessionSelectorProps): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground min-w-0 flex-1">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      >
        <option value="">— 세션 선택 —</option>
        {sessions.map((s) => {
          const key = `${s.projectPath}::${s.sessionId}`;
          const label = `${s.projectName} · ${s.sessionId.slice(0, 8)} · ${formatTimeAgo(s.lastActivity)} · ${s.firstMessage.slice(0, 40) || '(제목 없음)'}`;
          return (
            <option key={key} value={key}>
              {label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

// ─── ComparePage ───

export function ComparePage(): React.JSX.Element {
  const { groups, fetchSessions } = useSessionStore();
  const [sessionKeyA, setSessionKeyA] = useState<string>('');
  const [sessionKeyB, setSessionKeyB] = useState<string>('');

  useEffect(() => {
    if (groups.length === 0) fetchSessions();
  }, [groups.length, fetchSessions]);

  // 모든 세션을 최근 활동순으로 평탄화
  const allSessions = useMemo(
    () =>
      groups
        .flatMap((g) => g.sessions)
        .slice()
        .sort((a, b) => b.lastActivity - a.lastActivity),
    [groups]
  );

  return (
    <div className="flex h-full flex-col" data-testid="page-compare">
      {/* 선택 바 */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <GitCompare className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">세션 비교</h2>
        </div>
        <div className="flex gap-3">
          <SessionSelector
            label="세션 A"
            sessions={allSessions}
            value={sessionKeyA}
            onChange={setSessionKeyA}
            testId="compare-select-a"
          />
          <SessionSelector
            label="세션 B"
            sessions={allSessions}
            value={sessionKeyB}
            onChange={setSessionKeyB}
            testId="compare-select-b"
          />
        </div>
      </div>

      {/* 본문 — 빈 상태 */}
      <div className="flex-1 overflow-y-auto">
        {!sessionKeyA || !sessionKeyB ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <GitCompare className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">비교할 두 세션을 선택하세요</p>
              <p className="text-xs mt-1">메시지/도구/토큰/비용을 side-by-side로 비교합니다</p>
            </div>
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">
            {/* Commit 2에서 통계 비교 + Commit 3에서 side-by-side 메시지 추가 예정 */}
            선택됨: {sessionKeyA.split('::')[1]?.slice(0, 8)} vs{' '}
            {sessionKeyB.split('::')[1]?.slice(0, 8)}
          </div>
        )}
      </div>
    </div>
  );
}
