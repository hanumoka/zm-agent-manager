import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Zap, FolderOpen, Globe, Wrench, Cpu, Ban } from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils';
import type { SkillInfo, SkillScope } from '@shared/types';

// ─── 포맷 ───

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// ─── SkillCard ───

interface SkillCardProps {
  skill: SkillInfo;
}

const SkillCard = memo(function SkillCard({ skill }: SkillCardProps): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2" data-testid="skill-card">
      <div className="flex items-start gap-2">
        <Zap className="h-4 w-4 shrink-0 mt-0.5 text-accent-yellow" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">{skill.name}</span>
            {skill.disableModelInvocation && (
              <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground"
                title="model이 자동 호출할 수 없음 (사용자 명령 전용)"
              >
                <Ban className="h-2.5 w-2.5" />
                수동
              </span>
            )}
          </div>
          {skill.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{skill.description}</p>
          )}
        </div>
      </div>

      {(skill.allowedTools.length > 0 || skill.model) && (
        <div className="flex flex-wrap gap-2 pl-6 text-xs text-muted-foreground">
          {skill.model && (
            <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">
              <Cpu className="h-3 w-3" />
              {skill.model}
            </span>
          )}
          {skill.allowedTools.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              {skill.allowedTools.join(', ')}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 pl-6 text-xs text-muted-foreground font-mono">
        <span>{formatBytes(skill.sizeBytes)}</span>
        <span>·</span>
        <span>{formatTimeAgo(skill.lastModified)}</span>
      </div>
    </div>
  );
});

// ─── ScopeSection ───

interface ScopeSectionProps {
  scope: SkillScope;
  skills: SkillInfo[];
}

const SCOPE_CONFIG: Record<SkillScope, { label: string; icon: React.ElementType; color: string }> =
  {
    project: { label: '프로젝트', icon: FolderOpen, color: 'text-primary' },
    global: { label: '글로벌', icon: Globe, color: 'text-accent-green' },
    plugin: { label: '플러그인', icon: Zap, color: 'text-accent-orange' },
  };

function ScopeSection({ scope, skills }: ScopeSectionProps): React.JSX.Element | null {
  if (skills.length === 0) return null;
  const { label, icon: Icon, color } = SCOPE_CONFIG[scope];
  return (
    <div className="space-y-2" data-testid={`skills-scope-${scope}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <h2 className="text-sm font-semibold text-foreground">{label}</h2>
        <span className="text-xs text-muted-foreground">({skills.length})</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {skills.map((skill) => (
          <SkillCard key={`${scope}-${skill.name}-${skill.filePath}`} skill={skill} />
        ))}
      </div>
    </div>
  );
}

// ─── SkillsPage ───

export function SkillsPage(): React.JSX.Element {
  const [skills, setSkills] = useState<SkillInfo[] | null>(null);
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
        const result = await window.api?.getSkills?.();
        if (!result) throw new Error('preload API를 사용할 수 없습니다');
        if (isMountedRef.current) setSkills(result);
      } catch (err) {
        if (isMountedRef.current)
          setError(err instanceof Error ? err.message : '스킬 목록 조회 실패');
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    }
    load();
  }, []);

  const grouped = useMemo(() => {
    const acc: Record<SkillScope, SkillInfo[]> = { project: [], global: [], plugin: [] };
    for (const s of skills ?? []) acc[s.scope].push(s);
    return acc;
  }, [skills]);

  if (isLoading) {
    return (
      <div className="space-y-3 p-6" data-testid="page-skills">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-destructive" data-testid="page-skills">
        <p>스킬 목록을 불러올 수 없습니다: {error}</p>
      </div>
    );
  }

  if (!skills || skills.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-muted-foreground"
        data-testid="page-skills"
      >
        <div className="text-center">
          <Zap className="h-12 w-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">등록된 스킬이 없습니다</p>
          <p className="text-xs mt-1">
            <code>.claude/skills/&#123;name&#125;/SKILL.md</code>를 생성하면 여기에 표시됩니다
          </p>
        </div>
      </div>
    );
  }

  const totalCount = skills.length;

  return (
    <div className="space-y-6 p-6 overflow-y-auto h-full" data-testid="page-skills">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-accent-yellow" />
        <h1 className="text-lg font-semibold text-foreground">스킬 모니터</h1>
        <span className="text-sm text-muted-foreground">총 {totalCount}개</span>
      </div>

      <ScopeSection scope="project" skills={grouped.project} />
      <ScopeSection scope="global" skills={grouped.global} />
      <ScopeSection scope="plugin" skills={grouped.plugin} />
    </div>
  );
}
