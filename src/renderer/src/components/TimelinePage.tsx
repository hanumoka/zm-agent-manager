import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Wrench, Bot, FolderOpen, Play } from 'lucide-react';
import { useSessionStore } from '@/stores/session-store';
import { MessageTimeline } from '@/components/MessageTimeline';
import { ToolTracker } from '@/components/ToolTracker';
import { SubagentPanel } from '@/components/SubagentPanel';
import { FileChangePanel } from '@/components/FileChangePanel';
import { ReplayPlayer } from '@/components/ReplayPlayer';

type TabId = 'messages' | 'tools' | 'subagents' | 'files' | 'replay';

export function TimelinePage(): React.JSX.Element {
  const { projectEncoded, sessionId } = useParams<{
    projectEncoded: string;
    sessionId: string;
  }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('messages');
  const [subagentCount, setSubagentCount] = useState(0);
  const {
    currentSession,
    isParsingSession,
    error,
    loadSession,
    clearCurrentSession,
    addNewRecords,
  } = useSessionStore();

  // 세션 로드/정리
  useEffect(() => {
    if (projectEncoded && sessionId) {
      loadSession(projectEncoded, sessionId);
    }
    return () => clearCurrentSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectEncoded, sessionId]);

  // 서브에이전트 수 로드
  useEffect(() => {
    if (projectEncoded && sessionId) {
      window.api
        ?.getSessionSubagents?.(projectEncoded, sessionId)
        ?.then((agents) => setSubagentCount(agents.length))
        ?.catch(() => setSubagentCount(0));
    }
  }, [projectEncoded, sessionId]);

  // 실시간 새 레코드 수신 (별도 effect로 분리하여 리스너 누수 방지)
  useEffect(() => {
    if (!window.api?.onNewRecords) return;
    const unsubscribe = window.api.onNewRecords((data) => {
      if (data.sessionId === sessionId) {
        addNewRecords(data.records);
      }
    });
    return unsubscribe;
  }, [sessionId, addNewRecords]);

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

  // 파일 변경 수 계산
  const fileChangeCount = currentSession.records.filter(
    (r) =>
      r.type === 'assistant' &&
      r.message?.content?.some(
        (b) =>
          b.type === 'tool_use' &&
          (b.name === 'Write' || b.name === 'Edit') &&
          'file_path' in (b.input as Record<string, unknown>)
      )
  ).length;

  const tabs: { id: TabId; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'messages', label: 'Messages', icon: MessageSquare, count: currentSession.messageCount },
    { id: 'tools', label: 'Tools', icon: Wrench, count: currentSession.toolCallCount },
    ...(subagentCount > 0
      ? [{ id: 'subagents' as TabId, label: 'Agents', icon: Bot, count: subagentCount }]
      : []),
    ...(fileChangeCount > 0
      ? [{ id: 'files' as TabId, label: 'Files', icon: FolderOpen, count: fileChangeCount }]
      : []),
  ];

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
        <span className="text-sm font-mono text-muted-foreground">
          {currentSession.sessionId.slice(0, 8)}
        </span>
        {/* Replay 버튼 */}
        <button
          onClick={() => setActiveTab(activeTab === 'replay' ? 'messages' : 'replay')}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors ${
            activeTab === 'replay'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent'
          }`}
        >
          <Play className="h-3 w-3" />
          Replay
        </button>
        <div className="flex-1" />
        {/* 탭 */}
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${
                activeTab === tab.id
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50'
              }`}
            >
              <tab.icon className="h-3 w-3" />
              {tab.label}
              <span className="text-muted-foreground">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 min-h-0">
        {activeTab === 'messages' && <MessageTimeline records={currentSession.records} />}
        {activeTab === 'tools' && <ToolTracker records={currentSession.records} />}
        {activeTab === 'subagents' && projectEncoded && sessionId && (
          <SubagentPanel projectEncoded={projectEncoded} sessionId={sessionId} />
        )}
        {activeTab === 'files' && <FileChangePanel records={currentSession.records} />}
        {activeTab === 'replay' && <ReplayPlayer records={currentSession.records} />}
      </div>
    </div>
  );
}
