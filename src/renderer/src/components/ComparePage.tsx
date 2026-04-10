import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GitCompare, MessageSquare, Wrench, Cpu, DollarSign } from 'lucide-react';
import { useSessionStore } from '@/stores/session-store';
import { formatTimeAgo } from '@/lib/utils';
import { encodeProjectPath } from '@shared/types';
import type { ParsedSession, SessionMeta, AssistantRecord } from '@shared/types';
import { MessageTimeline } from '@/components/MessageTimeline';

/**
 * 세션 비교 페이지 (F10)
 *
 * 상단: 두 드롭다운으로 세션 A/B 선택
 * 중단: 선택된 두 세션의 통계 비교 (Commit 2)
 * 하단: 좌/우 병렬 MessageTimeline + 도구 호출 분포 (Commit 3)
 */

// ─── SessionSelector ───

interface SessionSelectorProps {
  label: string;
  sessions: SessionMeta[];
  value: string;
  onChange: (sessionKey: string) => void;
  testId: string;
}

function SessionSelector({
  label,
  sessions,
  value,
  onChange,
  testId,
}: SessionSelectorProps): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground min-w-0 flex-1">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      >
        <option value="">— 세션 선택 —</option>
        {sessions.map((s) => {
          const key = `${s.projectPath}::${s.sessionId}`;
          const label = `${s.projectName} · ${s.sessionId.slice(0, 8)} · ${formatTimeAgo(s.lastActivity)} · ${s.firstMessage.slice(0, 40) || '(제목 없음)'}`;
          return (
            <option key={key} value={key}>
              {label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

// ─── 집계 헬퍼 ───

/** 모델별 가격 테이블 (cost-scanner와 동일) */
const MODEL_PRICING: Record<
  string,
  { input: number; output: number; cacheRead: number; cacheWrite: number }
> = {
  'claude-opus-4-6': { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  'claude-opus-4-20250514': { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-sonnet-4-20250514': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
};
const DEFAULT_PRICING = { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 };

interface SessionMetrics {
  messageCount: number;
  toolCallCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  cost: number;
  /** 도구 이름별 사용 횟수 */
  toolDistribution: Map<string, number>;
}

function computeMetrics(session: ParsedSession): SessionMetrics {
  const metrics: SessionMetrics = {
    messageCount: session.messageCount,
    toolCallCount: session.toolCallCount,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    cost: 0,
    toolDistribution: new Map(),
  };

  for (const record of session.records) {
    if (record.type !== 'assistant') continue;
    const assistant = record as AssistantRecord;
    const message = assistant.message;

    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'tool_use') {
          const name = block.name;
          metrics.toolDistribution.set(name, (metrics.toolDistribution.get(name) ?? 0) + 1);
        }
      }
    }

    if (message.usage && message.model) {
      const u = message.usage;
      const input = u.input_tokens ?? 0;
      const output = u.output_tokens ?? 0;
      const cacheRead = u.cache_read_input_tokens ?? 0;
      const cacheWrite = u.cache_creation_input_tokens ?? 0;
      metrics.inputTokens += input;
      metrics.outputTokens += output;
      metrics.cacheReadTokens += cacheRead;
      metrics.cacheWriteTokens += cacheWrite;
      const pricing = MODEL_PRICING[message.model] ?? DEFAULT_PRICING;
      metrics.cost +=
        (input / 1_000_000) * pricing.input +
        (output / 1_000_000) * pricing.output +
        (cacheRead / 1_000_000) * pricing.cacheRead +
        (cacheWrite / 1_000_000) * pricing.cacheWrite;
    }
  }

  metrics.totalTokens =
    metrics.inputTokens + metrics.outputTokens + metrics.cacheReadTokens + metrics.cacheWriteTokens;
  return metrics;
}

// ─── 포맷 ───

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

// ─── MetricRow ───

interface MetricRowProps {
  label: string;
  icon: React.ElementType;
  valueA: string;
  valueB: string;
  /** 원래 수치 (차이 계산용) */
  rawA: number;
  rawB: number;
  /** 차이값 포맷터. 미지정 시 정수 카운트 가정 */
  diffFormatter?: (diff: number) => string;
}

function MetricRow({
  label,
  icon: Icon,
  valueA,
  valueB,
  rawA,
  rawB,
  diffFormatter = formatDiffValue,
}: MetricRowProps): React.JSX.Element {
  const diff = rawB - rawA;
  const formatted = diffFormatter(diff);
  const diffText = diff === 0 ? '—' : diff > 0 ? `+${formatted}` : formatted;
  const diffColor =
    diff === 0 ? 'text-muted-foreground' : diff > 0 ? 'text-accent-orange' : 'text-accent-green';

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-2 border-b border-border/50 last:border-b-0">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <span className="text-sm font-medium text-foreground tabular-nums text-right w-24">
        {valueA}
      </span>
      <span className="text-sm font-medium text-foreground tabular-nums text-right w-24">
        {valueB}
      </span>
      <span className={`text-xs font-mono tabular-nums text-right w-20 ${diffColor}`}>
        {diffText}
      </span>
    </div>
  );
}

/** 정수 카운트용 기본 포맷터 (메시지/도구/토큰 등) */
function formatDiffValue(diff: number): string {
  const abs = Math.abs(diff);
  if (abs >= 1_000_000) return `${(diff / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(diff / 1_000).toFixed(1)}K`;
  return String(Math.round(diff));
}

/** 비용 차이 포맷터 — 항상 $N.NN. MetricRow가 양수일 때 '+' prefix를 붙여줌. */
function formatCostDiff(diff: number): string {
  if (diff >= 0) return `$${diff.toFixed(2)}`;
  return `-$${Math.abs(diff).toFixed(2)}`;
}

// ─── ComparisonPanel ───

interface ComparisonPanelProps {
  sessionA: SessionMeta;
  sessionB: SessionMeta;
  metricsA: SessionMetrics;
  metricsB: SessionMetrics;
}

function ComparisonPanel({
  sessionA,
  sessionB,
  metricsA,
  metricsB,
}: ComparisonPanelProps): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card p-4 mb-4" data-testid="compare-metrics">
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 pb-2 border-b border-border mb-1 text-xs text-muted-foreground">
        <span>지표</span>
        <span className="w-24 text-right">A · {sessionA.sessionId.slice(0, 8)}</span>
        <span className="w-24 text-right">B · {sessionB.sessionId.slice(0, 8)}</span>
        <span className="w-20 text-right">차이 (B−A)</span>
      </div>
      <MetricRow
        label="메시지"
        icon={MessageSquare}
        valueA={metricsA.messageCount.toLocaleString()}
        valueB={metricsB.messageCount.toLocaleString()}
        rawA={metricsA.messageCount}
        rawB={metricsB.messageCount}
      />
      <MetricRow
        label="도구 호출"
        icon={Wrench}
        valueA={metricsA.toolCallCount.toLocaleString()}
        valueB={metricsB.toolCallCount.toLocaleString()}
        rawA={metricsA.toolCallCount}
        rawB={metricsB.toolCallCount}
      />
      <MetricRow
        label="총 토큰"
        icon={Cpu}
        valueA={formatTokens(metricsA.totalTokens)}
        valueB={formatTokens(metricsB.totalTokens)}
        rawA={metricsA.totalTokens}
        rawB={metricsB.totalTokens}
      />
      <MetricRow
        label="비용"
        icon={DollarSign}
        valueA={formatCost(metricsA.cost)}
        valueB={formatCost(metricsB.cost)}
        rawA={metricsA.cost}
        rawB={metricsB.cost}
        diffFormatter={formatCostDiff}
      />
    </div>
  );
}

// ─── ToolDistributionPanel ───

interface ToolDistributionPanelProps {
  distA: Map<string, number>;
  distB: Map<string, number>;
}

function ToolDistributionPanel({ distA, distB }: ToolDistributionPanelProps): React.JSX.Element {
  // 두 분포의 union 키 목록을 총 사용량 내림차순으로 정렬
  const sortedTools = useMemo(() => {
    const union = new Set<string>([...distA.keys(), ...distB.keys()]);
    return [...union]
      .map((name) => ({
        name,
        countA: distA.get(name) ?? 0,
        countB: distB.get(name) ?? 0,
        total: (distA.get(name) ?? 0) + (distB.get(name) ?? 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [distA, distB]);

  const maxCount = useMemo(
    () => sortedTools.reduce((acc, t) => Math.max(acc, t.countA, t.countB), 0),
    [sortedTools]
  );

  if (sortedTools.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 mb-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">도구 호출 분포</h3>
        <p className="text-xs text-muted-foreground">도구 호출이 없습니다</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-border bg-card p-4 mb-4"
      data-testid="compare-tool-distribution"
    >
      <h3 className="text-sm font-semibold text-foreground mb-3">도구 호출 분포</h3>
      <div className="space-y-2">
        {sortedTools.map(({ name, countA, countB }) => (
          <div key={name} className="grid grid-cols-[120px_1fr_1fr] items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground truncate">{name}</span>
            {/* 세션 A 바 */}
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${maxCount > 0 ? (countA / maxCount) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-foreground w-10 text-right">{countA}</span>
            </div>
            {/* 세션 B 바 */}
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-accent-orange"
                  style={{ width: `${maxCount > 0 ? (countB / maxCount) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-foreground w-10 text-right">{countB}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 pt-2 border-t border-border text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-4 rounded bg-primary" />
          세션 A
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-4 rounded bg-accent-orange" />
          세션 B
        </span>
      </div>
    </div>
  );
}

// ─── SideBySideTimeline ───

interface SideBySideTimelineProps {
  sessionA: SessionMeta;
  sessionB: SessionMeta;
  parsedA: ParsedSession;
  parsedB: ParsedSession;
}

function SideBySideTimeline({
  sessionA,
  sessionB,
  parsedA,
  parsedB,
}: SideBySideTimelineProps): React.JSX.Element {
  return (
    <div
      className="rounded-lg border border-border bg-card overflow-hidden"
      data-testid="compare-timeline"
    >
      <div className="grid grid-cols-2 border-b border-border">
        <div className="px-4 py-2 border-r border-border">
          <p className="text-xs text-muted-foreground">세션 A · {sessionA.sessionId.slice(0, 8)}</p>
          <p className="text-sm font-medium text-foreground truncate">
            {sessionA.firstMessage || '(제목 없음)'}
          </p>
        </div>
        <div className="px-4 py-2">
          <p className="text-xs text-muted-foreground">세션 B · {sessionB.sessionId.slice(0, 8)}</p>
          <p className="text-sm font-medium text-foreground truncate">
            {sessionB.firstMessage || '(제목 없음)'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2" style={{ height: '500px' }}>
        <div className="border-r border-border overflow-hidden">
          <MessageTimeline records={parsedA.records} />
        </div>
        <div className="overflow-hidden">
          <MessageTimeline records={parsedB.records} />
        </div>
      </div>
    </div>
  );
}

// ─── ComparePage ───

export function ComparePage(): React.JSX.Element {
  const { groups, fetchSessions } = useSessionStore();
  const [sessionKeyA, setSessionKeyA] = useState<string>('');
  const [sessionKeyB, setSessionKeyB] = useState<string>('');
  const [parsedA, setParsedA] = useState<ParsedSession | null>(null);
  const [parsedB, setParsedB] = useState<ParsedSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (groups.length === 0) fetchSessions();
  }, [groups.length, fetchSessions]);

  // 모든 세션을 최근 활동순으로 평탄화
  const allSessions = useMemo(
    () =>
      groups
        .flatMap((g) => g.sessions)
        .slice()
        .sort((a, b) => b.lastActivity - a.lastActivity),
    [groups]
  );

  const sessionA = useMemo(
    () => allSessions.find((s) => `${s.projectPath}::${s.sessionId}` === sessionKeyA),
    [allSessions, sessionKeyA]
  );
  const sessionB = useMemo(
    () => allSessions.find((s) => `${s.projectPath}::${s.sessionId}` === sessionKeyB),
    [allSessions, sessionKeyB]
  );

  // 두 세션이 모두 선택되면 병렬로 parseSession 호출
  // 요청 토큰을 사용하여 stale 응답을 무시 — 사용자가 로드 중 다른 세션을 선택하면
  // 이전 Promise의 결과가 현재 상태를 덮어쓰지 않도록 한다.
  const loadTokenRef = useRef(0);

  const loadBoth = useCallback(async () => {
    if (!sessionA || !sessionB) return;
    const requestToken = ++loadTokenRef.current;
    // 호출 시점의 선택값 스냅샷
    const snapshotA = sessionA;
    const snapshotB = sessionB;

    setIsLoading(true);
    setError(null);
    try {
      const [a, b] = await Promise.all([
        window.api?.parseSession?.(encodeProjectPath(snapshotA.projectPath), snapshotA.sessionId),
        window.api?.parseSession?.(encodeProjectPath(snapshotB.projectPath), snapshotB.sessionId),
      ]);
      if (!a || !b) throw new Error('preload API를 사용할 수 없습니다');
      // stale 체크: 이후 새 loadBoth가 시작되었으면 이 결과는 버린다
      if (!isMountedRef.current || requestToken !== loadTokenRef.current) return;
      setParsedA(a);
      setParsedB(b);
    } catch (err) {
      if (isMountedRef.current && requestToken === loadTokenRef.current) {
        setError(err instanceof Error ? err.message : '세션 로드 실패');
      }
    } finally {
      if (isMountedRef.current && requestToken === loadTokenRef.current) {
        setIsLoading(false);
      }
    }
  }, [sessionA, sessionB]);

  useEffect(() => {
    if (sessionA && sessionB) {
      loadBoth();
    } else {
      setParsedA(null);
      setParsedB(null);
    }
  }, [sessionA, sessionB, loadBoth]);

  const metricsA = useMemo(() => (parsedA ? computeMetrics(parsedA) : null), [parsedA]);
  const metricsB = useMemo(() => (parsedB ? computeMetrics(parsedB) : null), [parsedB]);

  return (
    <div className="flex h-full flex-col" data-testid="page-compare">
      {/* 선택 바 */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <GitCompare className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">세션 비교</h2>
        </div>
        <div className="flex gap-3">
          <SessionSelector
            label="세션 A"
            sessions={allSessions}
            value={sessionKeyA}
            onChange={setSessionKeyA}
            testId="compare-select-a"
          />
          <SessionSelector
            label="세션 B"
            sessions={allSessions}
            value={sessionKeyB}
            onChange={setSessionKeyB}
            testId="compare-select-b"
          />
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto p-4">
        {!sessionA || !sessionB ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <GitCompare className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">비교할 두 세션을 선택하세요</p>
              <p className="text-xs mt-1">메시지/도구/토큰/비용을 side-by-side로 비교합니다</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            <div className="h-32 rounded-lg bg-muted animate-pulse" />
            <div className="h-48 rounded-lg bg-muted animate-pulse" />
          </div>
        ) : error ? (
          <p className="text-destructive text-sm">세션 로드 실패: {error}</p>
        ) : metricsA && metricsB && parsedA && parsedB ? (
          <>
            <ComparisonPanel
              sessionA={sessionA}
              sessionB={sessionB}
              metricsA={metricsA}
              metricsB={metricsB}
            />
            <ToolDistributionPanel
              distA={metricsA.toolDistribution}
              distB={metricsB.toolDistribution}
            />
            <SideBySideTimeline
              sessionA={sessionA}
              sessionB={sessionB}
              parsedA={parsedA}
              parsedB={parsedB}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
