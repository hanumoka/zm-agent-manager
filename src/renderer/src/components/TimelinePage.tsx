import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Wrench } from 'lucide-react';
import { useSessionStore } from '@/stores/session-store';
import { MessageTimeline } from '@/components/MessageTimeline';

export function TimelinePage(): React.JSX.Element {
  const { projectEncoded, sessionId } = useParams<{
    projectEncoded: string;
    sessionId: string;
  }>();
  const navigate = useNavigate();
  const {
    currentSession,
    isParsingSession,
    error,
    loadSession,
    clearCurrentSession,
    addNewRecords,
  } = useSessionStore();

  useEffect(() => {
    if (projectEncoded && sessionId) {
      loadSession(projectEncoded, sessionId);
    }

    // 실시간 새 레코드 수신
    const unsubscribe = window.api.onNewRecords((data) => {
      if (data.sessionId === sessionId) {
        addNewRecords(data.records);
      }
    });

    return () => {
      unsubscribe();
      clearCurrentSession();
    };
  }, [projectEncoded, sessionId, loadSession, clearCurrentSession, addNewRecords]);

  if (isParsingSession) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-4 py-3">
          <div className="h-5 w-32 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex-1 space-y-3 p-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-destructive">
        <p>세션을 불러올 수 없습니다: {error}</p>
        <button
          onClick={() => navigate('/sessions')}
          className="mt-2 text-sm text-primary hover:underline"
        >
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        세션을 선택해주세요
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          onClick={() => navigate('/sessions')}
          className="rounded-md p-1 hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-mono text-muted-foreground">
            {currentSession.sessionId.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {currentSession.messageCount}
          </span>
          <span className="flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            {currentSession.toolCallCount}
          </span>
        </div>
      </div>

      {/* 타임라인 */}
      <div className="flex-1 min-h-0">
        <MessageTimeline records={currentSession.records} />
      </div>
    </div>
  );
}
