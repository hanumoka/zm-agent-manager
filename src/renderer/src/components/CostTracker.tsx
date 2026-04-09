import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, Cpu, ArrowUpDown, Hash, Wallet } from 'lucide-react';
import type { CostSummary, ModelCost, BudgetSettings } from '@shared/types';

// ─── 토큰 포맷 ───

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function formatCost(cost: number): string {
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  if (cost >= 0.01) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(4)}`;
}

// ─── 모델명 간소화 ───

function shortModelName(model: string): string {
  if (model.includes('opus')) return 'Opus';
  if (model.includes('sonnet')) return 'Sonnet';
  if (model.includes('haiku')) return 'Haiku';
  return model;
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

// ─── BudgetCard ───

/** YYYY-MM-DD 로컬 오늘 / YYYY-MM 로컬 이번 달 */
function todayLocalKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function monthLocalKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface BudgetCardProps {
  summary: CostSummary;
}

function BudgetCard({ summary }: BudgetCardProps): React.JSX.Element {
  const [settings, setSettings] = useState<BudgetSettings | null>(null);
  const [dailyInput, setDailyInput] = useState('');
  const [monthlyInput, setMonthlyInput] = useState('');
  const [alertPercentInput, setAlertPercentInput] = useState(80);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 초기 로드
  useEffect(() => {
    let mounted = true;
    window.api
      ?.getBudgetSettings?.()
      ?.then((s) => {
        if (!mounted) return;
        setSettings(s);
        setDailyInput(s.dailyUsd != null ? String(s.dailyUsd) : '');
        setMonthlyInput(s.monthlyUsd != null ? String(s.monthlyUsd) : '');
        setAlertPercentInput(s.alertPercent);
      })
      ?.catch((e) => {
        if (mounted) setError(e instanceof Error ? e.message : '예산 설정 로드 실패');
      });
    return () => {
      mounted = false;
    };
  }, []);

  // 오늘/이번 달 비용
  const today = todayLocalKey();
  const month = monthLocalKey();
  const todayCost = useMemo(
    () => summary.byDay.filter((d) => d.date === today).reduce((a, d) => a + d.cost, 0),
    [summary, today]
  );
  const monthCost = useMemo(
    () => summary.byDay.filter((d) => d.date.startsWith(month)).reduce((a, d) => a + d.cost, 0),
    [summary, month]
  );

  const handleSave = useCallback(async () => {
    if (!settings) return;
    const daily = dailyInput.trim() === '' ? null : Number(dailyInput);
    const monthly = monthlyInput.trim() === '' ? null : Number(monthlyInput);
    if (daily !== null && (Number.isNaN(daily) || daily < 0)) {
      setError('일별 예산은 0 이상 숫자여야 합니다');
      return;
    }
    if (monthly !== null && (Number.isNaN(monthly) || monthly < 0)) {
      setError('월별 예산은 0 이상 숫자여야 합니다');
      return;
    }
    const next: BudgetSettings = {
      dailyUsd: daily,
      monthlyUsd: monthly,
      alertPercent: alertPercentInput,
      // 임계값/예산이 변경되었으므로 알림 키 초기화 (재평가 가능)
      lastNotifiedKeys: [],
    };
    try {
      const saved = await window.api.setBudgetSettings(next);
      setSettings(saved);
      setSavedAt(Date.now());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    }
  }, [settings, dailyInput, monthlyInput, alertPercentInput]);

  const renderProgressBar = (
    label: string,
    actual: number,
    budget: number | null
  ): React.JSX.Element | null => {
    if (budget === null || budget <= 0) return null;
    const ratio = Math.min(actual / budget, 1.5);
    const pct = Math.round(ratio * 100);
    const overBudget = ratio >= 1;
    const reachedAlert = ratio >= alertPercentInput / 100;
    const barColor = overBudget
      ? 'bg-destructive'
      : reachedAlert
        ? 'bg-accent-orange'
        : 'bg-accent-green';
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span>
            {formatCost(actual)} / {formatCost(budget)} ({pct}%)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full ${barColor} transition-all`}
            style={{ width: `${Math.min(pct, 100)}%` }}
            data-testid={`budget-bar-${label === '오늘' ? 'daily' : 'monthly'}`}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid="budget-card">
      <div className="flex items-center gap-2 mb-3">
        <Wallet className="h-4 w-4 text-accent-yellow" />
        <h2 className="text-sm font-semibold text-foreground">예산 알림</h2>
      </div>

      {/* 진행 바 (예산이 설정된 경우만) */}
      <div className="space-y-3 mb-4">
        {renderProgressBar('오늘', todayCost, settings?.dailyUsd ?? null)}
        {renderProgressBar('이번 달', monthCost, settings?.monthlyUsd ?? null)}
        {settings?.dailyUsd == null && settings?.monthlyUsd == null && (
          <p className="text-xs text-muted-foreground">
            아래에서 예산을 설정하면 임계 도달 시 데스크톱 알림을 받습니다.
          </p>
        )}
      </div>

      {/* 입력 폼 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          일별 예산 ($)
          <input
            type="number"
            min="0"
            step="0.01"
            value={dailyInput}
            onChange={(e) => setDailyInput(e.target.value)}
            placeholder="비활성"
            data-testid="budget-input-daily"
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          월별 예산 ($)
          <input
            type="number"
            min="0"
            step="0.01"
            value={monthlyInput}
            onChange={(e) => setMonthlyInput(e.target.value)}
            placeholder="비활성"
            data-testid="budget-input-monthly"
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          알림 임계 ({alertPercentInput}%)
          <input
            type="range"
            min="50"
            max="100"
            step="5"
            value={alertPercentInput}
            onChange={(e) => setAlertPercentInput(Number(e.target.value))}
            data-testid="budget-input-percent"
            className="accent-primary"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          data-testid="budget-save"
          className="rounded-md px-3 py-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          저장
        </button>
        {savedAt && (
          <span className="text-xs text-accent-green">
            저장됨 ({new Date(savedAt).toLocaleTimeString()})
          </span>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  );
}

// ─── ModelRow ───

function ModelRow({ model }: { model: ModelCost }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{shortModelName(model.model)}</span>
          <span className="text-xs text-muted-foreground font-mono">{model.model}</span>
        </div>
        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
          <span>입력: {formatTokens(model.inputTokens)}</span>
          <span>출력: {formatTokens(model.outputTokens)}</span>
          <span>캐시R: {formatTokens(model.cacheReadTokens)}</span>
          <span>캐시W: {formatTokens(model.cacheWriteTokens)}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-foreground">{formatCost(model.cost)}</p>
        <p className="text-xs text-muted-foreground">{model.requestCount.toLocaleString()}회</p>
      </div>
    </div>
  );
}

// ─── CostTracker ───

export function CostTracker(): React.JSX.Element {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const result = await window.api.getCostSummary();
        if (isMounted) setSummary(result);
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : '비용 조회 실패');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  // 차트 데이터: 최근 14일만 — "YYYY-MM-DD" 안전 파싱
  const chartData = useMemo(() => {
    if (!summary) return [];
    return summary.byDay.slice(-14).map((d) => {
      const parts = d.date.split('-');
      const label = parts.length === 3 ? `${parts[1]}-${parts[2]}` : d.date;
      return {
        date: label,
        cost: Math.round(d.cost * 1000) / 1000,
      };
    });
  }, [summary]);

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
        <p>비용 데이터를 불러올 수 없습니다: {error}</p>
      </div>
    );
  }

  if (!summary || summary.totalRequests === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>비용 데이터가 없습니다. Claude Code를 사용하면 여기에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 overflow-y-auto h-full" data-testid="page-costs">
      {/* StatCards */}
      <div className="flex gap-4">
        <StatCard
          label="총 비용"
          value={formatCost(summary.totalCost)}
          icon={DollarSign}
          color="bg-accent-green/20 text-accent-green"
        />
        <StatCard
          label="총 요청"
          value={summary.totalRequests.toLocaleString()}
          icon={Hash}
          color="bg-primary/20 text-primary"
        />
        <StatCard
          label="입력 토큰"
          value={formatTokens(summary.totalInputTokens)}
          icon={ArrowUpDown}
          color="bg-accent-yellow/20 text-accent-yellow"
        />
        <StatCard
          label="출력 토큰"
          value={formatTokens(summary.totalOutputTokens)}
          icon={Cpu}
          color="bg-accent-orange/20 text-accent-orange"
        />
      </div>

      {/* 일별 비용 차트 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">일별 비용 추이</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <XAxis
                dataKey="date"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                  fontSize: 12,
                }}
                formatter={(value: number) => [`$${value.toFixed(3)}`, '비용']}
              />
              <Bar
                dataKey="cost"
                name="비용"
                fill="hsl(var(--accent-green))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[180px] text-muted-foreground text-sm">
            비용 데이터가 없습니다
          </div>
        )}
      </div>

      {/* 예산 카드 */}
      <BudgetCard summary={summary} />

      {/* 모델별 비용 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-2">모델별 비용</h2>
        <div className="divide-y divide-border/50">
          {summary.byModel.map((model) => (
            <ModelRow key={model.model} model={model} />
          ))}
        </div>
      </div>
    </div>
  );
}
