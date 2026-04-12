import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { MessageSquare, Hash, Cpu, Activity } from 'lucide-react';
import type {
  StatsSummary,
  DailyActivity,
  HeatmapCell,
  ProjectStats,
  ModelTokenUsage,
} from '@shared/types';
import { formatCost, shortModelName } from '@shared/format';

// ─── 포맷 ───

function formatTokens(count: number): string {
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

// ─── StatCard ───

interface StatCardProps {
  label: string;
  value: string;
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

// ─── WhenYouWork 히트맵 ───

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface WhenYouWorkProps {
  heatmap: HeatmapCell[];
}

const WhenYouWork = memo(function WhenYouWork({ heatmap }: WhenYouWorkProps): React.JSX.Element {
  const maxCount = useMemo(() => heatmap.reduce((acc, c) => Math.max(acc, c.count), 0), [heatmap]);

  // [day][hour] 2D 배열로 변환
  const grid = useMemo(() => {
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const cell of heatmap) {
      g[cell.dayOfWeek][cell.hour] = cell.count;
    }
    return g;
  }, [heatmap]);

  const colorFor = (count: number): string => {
    if (maxCount === 0 || count === 0) return 'bg-muted';
    const intensity = count / maxCount;
    if (intensity >= 0.75) return 'bg-primary';
    if (intensity >= 0.5) return 'bg-primary/70';
    if (intensity >= 0.25) return 'bg-primary/40';
    return 'bg-primary/20';
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid="stats-heatmap">
      <h2 className="text-sm font-semibold text-foreground mb-3">When You Work (요일 × 시간)</h2>
      <div className="flex gap-2">
        {/* 요일 라벨 */}
        <div className="flex flex-col gap-1 pt-5 text-xs text-muted-foreground">
          {DAY_LABELS.map((label) => (
            <div key={label} className="h-4 leading-4">
              {label}
            </div>
          ))}
        </div>
        {/* 히트맵 그리드 */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-1 mb-1 text-[10px] text-muted-foreground">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="w-4 text-center">
                {h % 6 === 0 ? h : ''}
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {grid.map((row, dayIdx) => (
              <div key={dayIdx} className="flex gap-1">
                {row.map((count, hour) => (
                  <div
                    key={hour}
                    className={`h-4 w-4 rounded-sm ${colorFor(count)}`}
                    title={`${DAY_LABELS[dayIdx]} ${hour}시: ${count}회`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {maxCount === 0 && (
        <p className="mt-3 text-xs text-muted-foreground text-center">활동 기록이 없습니다</p>
      )}
    </div>
  );
});

// ─── DailyActivityChart ───

interface DailyActivityChartProps {
  dailyActivity: DailyActivity[];
}

const DailyActivityChart = memo(function DailyActivityChart({
  dailyActivity,
}: DailyActivityChartProps): React.JSX.Element {
  const chartData = useMemo(
    () =>
      dailyActivity.map((d) => {
        const parts = d.date.split('-');
        const label = parts.length === 3 ? `${parts[1]}-${parts[2]}` : d.date;
        return {
          date: label,
          messages: d.messageCount,
          tools: d.toolCallCount,
        };
      }),
    [dailyActivity]
  );

  const hasData = chartData.some((d) => d.messages > 0 || d.tools > 0);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">
        최근 {dailyActivity.length}일 활동
      </h2>
      {hasData ? (
        <ResponsiveContainer width="100%" height={200}>
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
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))',
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="messages"
              name="메시지"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="tools"
              name="도구"
              fill="hsl(var(--accent-orange))"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
          활동 데이터가 없습니다
        </div>
      )}
    </div>
  );
});

// ─── ModelUsageBars ───

interface ModelUsageBarsProps {
  byModel: ModelTokenUsage[];
}

const ModelUsageBars = memo(function ModelUsageBars({
  byModel,
}: ModelUsageBarsProps): React.JSX.Element {
  const maxTokens = byModel.reduce((acc, m) => Math.max(acc, m.totalTokens), 0);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">모델별 토큰 사용량</h2>
      {byModel.length === 0 ? (
        <p className="text-xs text-muted-foreground">모델 데이터가 없습니다</p>
      ) : (
        <div className="space-y-3">
          {byModel.map((m) => (
            <div key={m.model}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {shortModelName(m.model)}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">{m.model}</span>
                </div>
                <span className="text-sm text-muted-foreground">{formatTokens(m.totalTokens)}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${maxTokens > 0 ? (m.totalTokens / maxTokens) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                <span>입력: {formatTokens(m.inputTokens)}</span>
                <span>출력: {formatTokens(m.outputTokens)}</span>
                <span>캐시R: {formatTokens(m.cacheReadTokens)}</span>
                <span>캐시W: {formatTokens(m.cacheWriteTokens)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ─── ProjectTable ───

interface ProjectTableProps {
  byProject: ProjectStats[];
}

const ProjectTable = memo(function ProjectTable({
  byProject,
}: ProjectTableProps): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">프로젝트별 통계</h2>
      {byProject.length === 0 ? (
        <p className="text-xs text-muted-foreground">프로젝트 데이터가 없습니다</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left pb-2 font-medium">프로젝트</th>
                <th className="text-right pb-2 font-medium">세션</th>
                <th className="text-right pb-2 font-medium">메시지</th>
                <th className="text-right pb-2 font-medium">도구 호출</th>
                <th className="text-right pb-2 font-medium">비용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {byProject.map((p) => (
                <tr key={p.projectPath}>
                  <td className="py-2 text-foreground truncate max-w-xs">{p.projectName}</td>
                  <td className="py-2 text-right text-muted-foreground">
                    {formatNumber(p.sessionCount)}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">
                    {formatNumber(p.messageCount)}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">
                    {formatNumber(p.toolCallCount)}
                  </td>
                  <td className="py-2 text-right text-foreground font-medium">
                    {formatCost(p.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

// ─── StatsPage ───

export function StatsPage(): React.JSX.Element {
  const [summary, setSummary] = useState<StatsSummary | null>(null);
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
        const result = await window.api?.getStatsSummary?.();
        if (!result) throw new Error('preload API를 사용할 수 없습니다');
        if (isMountedRef.current) setSummary(result);
      } catch (err) {
        if (isMountedRef.current) setError(err instanceof Error ? err.message : '통계 조회 실패');
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6" data-testid="page-stats">
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
      <div className="p-6 text-destructive" data-testid="page-stats">
        <p>통계 데이터를 불러올 수 없습니다: {error}</p>
      </div>
    );
  }

  if (!summary || summary.totalSessions === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-muted-foreground"
        data-testid="page-stats"
      >
        <p>세션 데이터가 없습니다. Claude Code를 사용하면 여기에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 overflow-y-auto h-full" data-testid="page-stats">
      {/* StatCards */}
      <div className="flex gap-4">
        <StatCard
          label="총 세션"
          value={formatNumber(summary.totalSessions)}
          icon={Activity}
          color="bg-primary/20 text-primary"
        />
        <StatCard
          label="총 메시지"
          value={formatNumber(summary.totalMessages)}
          icon={MessageSquare}
          color="bg-accent-green/20 text-accent-green"
        />
        <StatCard
          label="총 토큰"
          value={formatTokens(summary.totalTokens)}
          icon={Cpu}
          color="bg-accent-yellow/20 text-accent-yellow"
        />
        <StatCard
          label="총 도구 호출"
          value={formatNumber(summary.totalToolCalls)}
          icon={Hash}
          color="bg-accent-orange/20 text-accent-orange"
        />
      </div>

      {/* Daily Activity */}
      <DailyActivityChart dailyActivity={summary.dailyActivity} />

      {/* When You Work 히트맵 */}
      <WhenYouWork heatmap={summary.heatmap} />

      {/* Model Usage */}
      <ModelUsageBars byModel={summary.byModel} />

      {/* By Project */}
      <ProjectTable byProject={summary.byProject} />
    </div>
  );
}
