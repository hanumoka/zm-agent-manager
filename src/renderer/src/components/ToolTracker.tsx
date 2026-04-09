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

      {/* 호출 목록 */}
      <ToolCallList calls={calls} />
    </div>
  );
}
