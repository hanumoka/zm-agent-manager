import { useMemo, useState } from 'react';
import {
  FileText,
  Terminal,
  Pencil,
  FolderSearch,
  Search,
  Globe,
  Bot,
  Wrench,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { JsonlRecord } from '@shared/types';

// 도구별 아이콘 매핑
const TOOL_ICONS: Record<string, React.ElementType> = {
  Read: FileText,
  Write: FileText,
  Edit: Pencil,
  Bash: Terminal,
  Glob: FolderSearch,
  Grep: Search,
  WebSearch: Globe,
  WebFetch: Globe,
  Agent: Bot,
};

// 도구별 색상 매핑
const TOOL_COLORS: Record<string, string> = {
  Read: 'text-blue-400',
  Write: 'text-green-400',
  Edit: 'text-yellow-400',
  Bash: 'text-orange-400',
  Glob: 'text-purple-400',
  Grep: 'text-purple-400',
  WebSearch: 'text-cyan-400',
  WebFetch: 'text-cyan-400',
  Agent: 'text-pink-400',
};

interface ToolStat {
  name: string;
  count: number;
  percentage: number;
}

interface ToolCall {
  name: string;
  id: string;
  input: Record<string, unknown>;
  timestamp: string | number;
}

function extractToolCalls(records: JsonlRecord[]): ToolCall[] {
  const calls: ToolCall[] = [];

  for (const record of records) {
    if (record.type !== 'assistant') continue;
    if (!record.message?.content) continue;

    for (const block of record.message.content) {
      if (block.type === 'tool_use') {
        calls.push({
          name: block.name,
          id: block.id,
          input: block.input,
          timestamp: record.timestamp,
        });
      }
    }
  }

  return calls;
}

function computeStats(calls: ToolCall[]): ToolStat[] {
  const counts = new Map<string, number>();
  for (const call of calls) {
    counts.set(call.name, (counts.get(call.name) ?? 0) + 1);
  }

  const total = calls.length;
  return [...counts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function ToolIcon({ name }: { name: string }): React.JSX.Element {
  const Icon = TOOL_ICONS[name] ?? Wrench;
  const color = TOOL_COLORS[name] ?? 'text-muted-foreground';
  return <Icon className={`h-4 w-4 ${color}`} />;
}

function ToolDistribution({ stats }: { stats: ToolStat[] }): React.JSX.Element {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        도구 분포
      </h3>
      {stats.map((stat) => (
        <div key={stat.name} className="flex items-center gap-2">
          <ToolIcon name={stat.name} />
          <span className="text-sm w-20 truncate">{stat.name}</span>
          <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${stat.percentage}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-12 text-right">
            {stat.count} ({stat.percentage}%)
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Tool Chain 분석 ───

interface ChainPattern {
  chain: string;
  count: number;
  percentage: number;
}

function extractChainPatterns(calls: ToolCall[], n: number): ChainPattern[] {
  if (calls.length < n) return [];
  const counts = new Map<string, number>();
  for (let i = 0; i <= calls.length - n; i++) {
    const chain = calls
      .slice(i, i + n)
      .map((c) => c.name)
      .join(' → ');
    counts.set(chain, (counts.get(chain) ?? 0) + 1);
  }
  const total = calls.length - n + 1;
  return [...counts.entries()]
    .map(([chain, count]) => ({
      chain,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

/** 도구 간 전이 빈도 (A → B) */
interface TransitionStat {
  from: string;
  to: string;
  count: number;
}

function extractTransitions(calls: ToolCall[]): TransitionStat[] {
  const counts = new Map<string, number>();
  for (let i = 0; i < calls.length - 1; i++) {
    const key = `${calls[i].name}→${calls[i + 1].name}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => {
      const [from, to] = key.split('→');
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

function ToolChainAnalysis({ calls }: { calls: ToolCall[] }): React.JSX.Element {
  const [chainSize, setChainSize] = useState(2);

  const patterns = useMemo(() => extractChainPatterns(calls, chainSize), [calls, chainSize]);
  const transitions = useMemo(() => extractTransitions(calls), [calls]);

  if (calls.length < 2) {
    return (
      <div className="text-xs text-muted-foreground">도구 호출이 2건 미만이라 체인 분석 불가</div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        도구 체인 패턴
      </h3>

      {/* 체인 크기 선택 */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">체인 길이:</span>
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => setChainSize(n)}
            className={`rounded px-2 py-0.5 transition-colors ${
              chainSize === n
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* 체인 패턴 리스트 */}
      {patterns.length === 0 ? (
        <p className="text-xs text-muted-foreground">해당 길이의 반복 패턴이 없습니다</p>
      ) : (
        <div className="space-y-1.5">
          {patterns.map((p) => (
            <div key={p.chain} className="flex items-center gap-2">
              <span className="text-xs font-mono flex-1 truncate text-foreground">{p.chain}</span>
              <div className="w-24 h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(p.percentage, 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-14 text-right">
                {p.count}회 ({p.percentage}%)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 전이 빈도 (상위 15개) */}
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">
        도구 전이 빈도 (A → B)
      </h3>
      <div className="space-y-1">
        {transitions.map((t) => (
          <div key={`${t.from}→${t.to}`} className="flex items-center gap-2 text-xs">
            <ToolIcon name={t.from} />
            <span className="w-14 truncate font-mono">{t.from}</span>
            <span className="text-muted-foreground">→</span>
            <ToolIcon name={t.to} />
            <span className="w-14 truncate font-mono">{t.to}</span>
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-accent-yellow"
                style={{
                  width: `${Math.min((t.count / (transitions[0]?.count || 1)) * 100, 100)}%`,
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground w-8 text-right">{t.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolCallList({ calls }: { calls: ToolCall[] }): React.JSX.Element {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 최근 50개만 표시
  const recentCalls = calls.slice(-50).reverse();

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        최근 호출 ({calls.length}건 중 최근 50건)
      </h3>
      {recentCalls.map((call) => {
        const isExpanded = expandedId === call.id;
        const summary = call.input.file_path
          ? String(call.input.file_path)
          : call.input.command
            ? String(call.input.command).slice(0, 60)
            : call.input.pattern
              ? String(call.input.pattern)
              : '';

        return (
          <div key={call.id} className="rounded-md border border-border/50">
            <button
              onClick={() => setExpandedId(isExpanded ? null : call.id)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-secondary/50 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
              <ToolIcon name={call.name} />
              <span className="text-xs font-mono font-medium">{call.name}</span>
              {summary && (
                <span className="text-xs text-muted-foreground truncate flex-1">{summary}</span>
              )}
            </button>
            {isExpanded && (
              <div className="border-t border-border/50 px-3 py-2 bg-secondary/30">
                <pre className="text-xs text-muted-foreground overflow-x-auto max-h-32 whitespace-pre-wrap">
                  {JSON.stringify(call.input, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface ToolTrackerProps {
  records: JsonlRecord[];
}

export function ToolTracker({ records }: ToolTrackerProps): React.JSX.Element {
  const calls = useMemo(() => extractToolCalls(records), [records]);
  const stats = useMemo(() => computeStats(calls), [calls]);

  if (calls.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        도구 호출이 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 overflow-y-auto h-full">
      {/* 요약 */}
      <div className="flex gap-4">
        <div className="rounded-lg border border-border bg-card p-3 flex-1">
          <p className="text-xs text-muted-foreground">총 도구 호출</p>
          <p className="text-2xl font-bold text-foreground">{calls.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 flex-1">
          <p className="text-xs text-muted-foreground">도구 종류</p>
          <p className="text-2xl font-bold text-foreground">{stats.length}</p>
        </div>
      </div>

      {/* 분포 차트 */}
      <ToolDistribution stats={stats} />

      {/* 체인 분석 */}
      <ToolChainAnalysis calls={calls} />

      {/* 호출 목록 */}
      <ToolCallList calls={calls} />
    </div>
  );
}
