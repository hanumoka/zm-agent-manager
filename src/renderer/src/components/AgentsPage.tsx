import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Users, FolderOpen, Globe, Wrench, Cpu } from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils';
import type { AgentInfo, SkillScope } from '@shared/types';

// ─── 포맷 ───

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// ─── AgentCard ───

const AgentCard = memo(function AgentCard({ agent }: { agent: AgentInfo }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2" data-testid="agent-card">
      <div className="flex items-start gap-2">
        <Users className="h-4 w-4 shrink-0 mt-0.5 text-cyan-400" />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-foreground truncate block">{agent.name}</span>
          {agent.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{agent.description}</p>
          )}
        </div>
      </div>

      {(agent.tools.length > 0 || agent.model) && (
        <div className="flex flex-wrap gap-2 pl-6 text-xs text-muted-foreground">
          {agent.model && (
            <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">
              <Cpu className="h-3 w-3" />
              {agent.model}
            </span>
          )}
          {agent.tools.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              {agent.tools.join(', ')}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 pl-6 text-xs text-muted-foreground font-mono">
        <span>{formatBytes(agent.sizeBytes)}</span>
        <span>·</span>
        <span>{formatTimeAgo(agent.lastModified)}</span>
      </div>
    </div>
  );
});

// ─── ScopeSection ───

const SCOPE_CONFIG: Record<SkillScope, { label: string; icon: React.ElementType; color: string }> =
  {
    project: { label: '프로젝트', icon: FolderOpen, color: 'text-primary' },
    global: { label: '글로벌', icon: Globe, color: 'text-accent-green' },
    plugin: { label: '플러그인', icon: Users, color: 'text-accent-orange' },
  };

function ScopeSection({
  scope,
  agents,
}: {
  scope: SkillScope;
  agents: AgentInfo[];
}): React.JSX.Element | null {
  if (agents.length === 0) return null;
  const { label, icon: Icon, color } = SCOPE_CONFIG[scope];
  return (
    <div className="space-y-2" data-testid={`agents-scope-${scope}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <h2 className="text-sm font-semibold text-foreground">{label}</h2>
        <span className="text-xs text-muted-foreground">({agents.length})</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {agents.map((agent) => (
          <AgentCard key={`${scope}-${agent.name}-${agent.filePath}`} agent={agent} />
        ))}
      </div>
    </div>
  );
}

// ─── AgentsPage ───

export function AgentsPage(): React.JSX.Element {
  const [agents, setAgents] = useState<AgentInfo[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    async function load(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const result = await window.api?.getAgents?.();
        if (!result) throw new Error('preload API를 사용할 수 없습니다');
        if (isMountedRef.current) setAgents(result);
      } catch (err) {
        if (isMountedRef.current)
          setError(err instanceof Error ? err.message : '에이전트 목록 조회 실패');
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    }
    load();
  }, []);

  const grouped = useMemo(() => {
    const acc: Record<SkillScope, AgentInfo[]> = { project: [], global: [], plugin: [] };
    for (const a of agents ?? []) acc[a.scope].push(a);
    return acc;
  }, [agents]);

  if (isLoading) {
    return (
      <div className="space-y-3 p-6" data-testid="page-agents">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-destructive" data-testid="page-agents">
        <p>에이전트 목록을 불러올 수 없습니다: {error}</p>
      </div>
    );
  }

  if (!agents || agents.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-muted-foreground"
        data-testid="page-agents"
      >
        <div className="text-center">
          <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">등록된 에이전트가 없습니다</p>
          <p className="text-xs mt-1">
            <code>.claude/agents/&#123;name&#125;.md</code>를 생성하면 여기에 표시됩니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 overflow-y-auto h-full" data-testid="page-agents">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-cyan-400" />
        <h1 className="text-lg font-semibold text-foreground">에이전트 모니터</h1>
        <span className="text-sm text-muted-foreground">총 {agents.length}개</span>
      </div>

      <ScopeSection scope="project" agents={grouped.project} />
      <ScopeSection scope="global" agents={grouped.global} />
      <ScopeSection scope="plugin" agents={grouped.plugin} />
    </div>
  );
}
