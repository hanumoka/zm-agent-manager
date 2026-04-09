import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '@/stores/session-store';
import { formatTimeAgo } from '@/lib/utils';
import { encodeProjectPath } from '@shared/types';
import type { SessionMeta } from '@shared/types';

interface SessionCardProps {
  session: SessionMeta;
  onSelect: (session: SessionMeta) => void;
}

function SessionCard({ session, onSelect }: SessionCardProps): React.JSX.Element {
  return (
    <button
      onClick={() => onSelect(session)}
      className="w-full text-left rounded-lg border border-border bg-card p-4 hover:bg-popover transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {session.isActive && (
            <span className="inline-block h-2 w-2 rounded-full bg-accent-green animate-pulse" />
          )}
          <span className="text-xs text-muted-foreground font-mono">
            {session.sessionId.slice(0, 8)}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{formatTimeAgo(session.lastActivity)}</span>
      </div>
      <p className="text-sm text-foreground line-clamp-2">
        {session.firstMessage || '(메시지 없음)'}
      </p>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{session.promptCount}개 프롬프트</span>
        {session.isActive && <span className="text-accent-green font-medium">활성</span>}
      </div>
    </button>
  );
}

export function SessionList(): React.JSX.Element {
  const { groups, isLoading, error, fetchSessions } = useSessionStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSelect = (session: SessionMeta): void => {
    const encoded = encodeProjectPath(session.projectPath);
    navigate(`/timeline/${encoded}/${session.sessionId}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-destructive">
        <p>세션 목록을 불러올 수 없습니다: {error}</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="p-6 text-muted-foreground">
        <p>세션이 없습니다. Claude Code를 사용하면 여기에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" data-testid="page-sessions">
      {groups.map((group) => (
        <div key={group.projectPath}>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            {group.projectName}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {group.sessions.length}개 세션
            </span>
          </h2>
          <div className="space-y-2">
            {group.sessions.map((session) => (
              <SessionCard key={session.sessionId} session={session} onSelect={handleSelect} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
