import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { FolderOpen, Activity, MessageSquare, Zap } from 'lucide-react';
import { useSessionStore } from '@/stores/session-store';
import { formatTimeAgo } from '@/lib/utils';
import { encodeProjectPath } from '@shared/types';
import type { SessionMeta } from '@shared/types';

// ─── StatCard ───

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

// ─── RecentSessionItem ───

interface RecentSessionItemProps {
  session: SessionMeta;
  onSelect: (session: SessionMeta) => void;
}

function RecentSessionItem({ session, onSelect }: RecentSessionItemProps): React.JSX.Element {
  return (
    <button
      onClick={() => onSelect(session)}
      className="flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-left hover:bg-accent/50 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {session.isActive && (
            <span className="inline-block h-2 w-2 rounded-full bg-accent-green animate-pulse" />
          )}
          <span className="text-sm text-foreground truncate">{session.projectName}</span>
          <span className="text-xs text-muted-foreground font-mono">
            {session.sessionId.slice(0, 8)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {session.firstMessage || '(메시지 없음)'}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-muted-foreground">{formatTimeAgo(session.lastActivity)}</p>
        <p className="text-xs text-muted-foreground">{session.messageCount}개</p>
      </div>
    </button>
  );
}

// ─── ActivityChart ───

interface DailyActivity {
  date: string;
  sessions: number;
}

function buildDailyActivity(allSessions: SessionMeta[], days: number = 14): DailyActivity[] {
  const now = new Date();
  const result: DailyActivity[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 86400000;

    const count = allSessions.filter(
      (s) => s.lastActivity >= dayStart && s.lastActivity < dayEnd
    ).length;

    result.push({ date: dateStr, sessions: count });
  }

  return result;
}

// ─── DashboardPage ───

export function DashboardPage(): React.JSX.Element {
  const { groups, isLoading, error, fetchSessions } = useSessionStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const allSessions = useMemo(() => groups.flatMap((g) => g.sessions), [groups]);

  const stats = useMemo(() => {
    const activeSessions = allSessions.filter((s) => s.isActive).length;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySessions = allSessions.filter((s) => s.lastActivity >= todayStart.getTime()).length;
    const totalMessages = allSessions.reduce((acc, s) => acc + s.messageCount, 0);
    return { projects: groups.length, activeSessions, todaySessions, totalMessages };
  }, [groups, allSessions]);

  const chartData = useMemo(() => buildDailyActivity(allSessions), [allSessions]);

  const recentSessions = useMemo(
    () => [...allSessions].sort((a, b) => b.lastActivity - a.lastActivity).slice(0, 10),
    [allSessions]
  );

  const handleSelect = (session: SessionMeta): void => {
    const encoded = encodeProjectPath(session.projectPath);
    navigate(`/timeline/${encoded}/${session.sessionId}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 flex-1 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-48 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-destructive">
        <p>대시보드 데이터를 불러올 수 없습니다: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 overflow-y-auto h-full">
      {/* StatCards */}
      <div className="flex gap-4">
        <StatCard
          label="프로젝트"
          value={stats.projects}
          icon={FolderOpen}
          color="bg-primary/20 text-primary"
        />
        <StatCard
          label="활성 세션"
          value={stats.activeSessions}
          icon={Activity}
          color="bg-accent-green/20 text-accent-green"
        />
        <StatCard
          label="오늘 세션"
          value={stats.todaySessions}
          icon={Zap}
          color="bg-accent-yellow/20 text-accent-yellow"
        />
        <StatCard
          label="총 메시지"
          value={stats.totalMessages.toLocaleString()}
          icon={MessageSquare}
          color="bg-accent-orange/20 text-accent-orange"
        />
      </div>

      {/* Activity Chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">최근 14일 활동</h2>
        {chartData.some((d) => d.sessions > 0) ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <XAxis
                dataKey="date"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                  fontSize: 12,
                }}
                labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
              />
              <Bar
                dataKey="sessions"
                name="세션"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[180px] text-muted-foreground text-sm">
            최근 14일간 활동이 없습니다
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-2">최근 세션</h2>
        {recentSessions.length > 0 ? (
          <div className="divide-y divide-border/50">
            {recentSessions.map((session) => (
              <RecentSessionItem
                key={session.sessionId}
                session={session}
                onSelect={handleSelect}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            세션이 없습니다. Claude Code를 사용하면 여기에 표시됩니다.
          </p>
        )}
      </div>
    </div>
  );
}
