import { useEffect, useState } from 'react';
import {
  Bot,
  Search,
  Pencil,
  ChevronDown,
  ChevronRight,
  Wrench,
  MessageSquare,
} from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils';
import { MessageTimeline } from '@/components/MessageTimeline';
import type { SubagentInfo } from '@shared/types';

// ─── 에이전트 타입별 아이콘 ───

const AGENT_TYPE_ICONS: Record<string, React.ElementType> = {
  Explore: Search,
  Plan: Pencil,
};

function AgentTypeIcon({ type }: { type: string }): React.JSX.Element {
  const Icon = AGENT_TYPE_ICONS[type] ?? Bot;
  return <Icon className="h-4 w-4" />;
}

// ─── SubagentCard ───

interface SubagentCardProps {
  agent: SubagentInfo;
}

function SubagentCard({ agent }: SubagentCardProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-accent/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-pink-500/20 text-pink-400">
          <AgentTypeIcon type={agent.agentType} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-pink-400">{agent.agentType}</span>
            <span className="text-xs text-muted-foreground font-mono">
              {agent.agentId.slice(0, 8)}
            </span>
          </div>
          <p className="text-sm text-foreground truncate">{agent.description || '(설명 없음)'}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {agent.messageCount}
          </span>
          <span className="flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            {agent.toolCallCount}
          </span>
          <span>{formatTimeAgo(agent.timestamp)}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border" style={{ height: '400px' }}>
          <MessageTimeline records={agent.records} />
        </div>
      )}
    </div>
  );
}

// ─── SubagentPanel ───

interface SubagentPanelProps {
  projectEncoded: string;
  sessionId: string;
}

export function SubagentPanel({
  projectEncoded,
  sessionId,
}: SubagentPanelProps): React.JSX.Element {
  const [subagents, setSubagents] = useState<SubagentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const result = await window.api.getSessionSubagents(projectEncoded, sessionId);
        if (isMounted) setSubagents(result);
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : '서브에이전트 조회 실패');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [projectEncoded, sessionId]);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        <p>서브에이전트를 불러올 수 없습니다: {error}</p>
      </div>
    );
  }

  if (subagents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        이 세션에서 사용된 서브에이전트가 없습니다
      </div>
    );
  }

  const totalMessages = subagents.reduce((acc, a) => acc + a.messageCount, 0);
  const totalTools = subagents.reduce((acc, a) => acc + a.toolCallCount, 0);

  return (
    <div className="space-y-4 p-4 overflow-y-auto h-full">
      {/* 요약 */}
      <div className="flex gap-4">
        <div className="rounded-lg border border-border bg-card p-3 flex-1">
          <p className="text-xs text-muted-foreground">서브에이전트</p>
          <p className="text-2xl font-bold text-foreground">{subagents.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 flex-1">
          <p className="text-xs text-muted-foreground">총 메시지</p>
          <p className="text-2xl font-bold text-foreground">{totalMessages}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 flex-1">
          <p className="text-xs text-muted-foreground">총 도구 호출</p>
          <p className="text-2xl font-bold text-foreground">{totalTools}</p>
        </div>
      </div>

      {/* 서브에이전트 목록 */}
      <div className="space-y-2">
        {subagents.map((agent) => (
          <SubagentCard key={agent.agentId} agent={agent} />
        ))}
      </div>
    </div>
  );
}
