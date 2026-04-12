import { useCallback, useEffect, useRef, useState } from 'react';
import { Settings, Shield, FileCode, Plug, Lock, Bell, FolderOpen } from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils';
import type {
  ConfigSummary,
  HookEntry,
  RuleFile,
  McpServer,
  NotificationSettings,
  NotificationHistoryEntry,
  ProjectSettings,
  KnownProject,
} from '@shared/types';

// ─── 포맷 ───

function formatBytes(bytes: number): string {
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// ─── Tabs ───

type TabId = 'hooks' | 'rules' | 'mcp' | 'permissions' | 'notifications' | 'projects';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'hooks', label: 'Hooks', icon: Shield },
  { id: 'rules', label: 'Rules', icon: FileCode },
  { id: 'mcp', label: 'MCP', icon: Plug },
  { id: 'permissions', label: 'Permissions', icon: Lock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
];

// ─── HooksTab ───

function HooksTab({ hooks }: { hooks: HookEntry[] }): React.JSX.Element {
  if (hooks.length === 0) {
    return <p className="text-xs text-muted-foreground">등록된 훅이 없습니다</p>;
  }

  // 이벤트별 그룹핑
  const groups = new Map<string, HookEntry[]>();
  for (const h of hooks) {
    const list = groups.get(h.event) ?? [];
    list.push(h);
    groups.set(h.event, list);
  }

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([event, entries]) => (
        <div key={event}>
          <h3 className="text-sm font-semibold text-foreground mb-2">{event}</h3>
          <div className="space-y-1">
            {entries.map((h, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-md border border-border/50 px-3 py-2 text-xs"
              >
                <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-muted-foreground font-mono shrink-0">
                  {h.matcher}
                </span>
                <span className="inline-flex rounded bg-primary/10 text-primary px-1.5 py-0.5 shrink-0">
                  {h.type}
                </span>
                <span className="text-muted-foreground font-mono truncate flex-1">{h.command}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── RulesTab ───

function RulesTab({ rules }: { rules: RuleFile[] }): React.JSX.Element {
  if (rules.length === 0) {
    return <p className="text-xs text-muted-foreground">등록된 규칙이 없습니다</p>;
  }
  return (
    <div className="space-y-2">
      {rules.map((r) => (
        <div
          key={r.name}
          className="flex items-center gap-3 rounded-md border border-border/50 px-3 py-2"
        >
          <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium text-foreground">{r.name}</span>
            <p className="text-xs text-muted-foreground font-mono truncate">{r.filePath}</p>
          </div>
          <span className="text-xs text-muted-foreground">{formatBytes(r.sizeBytes)}</span>
          <span className="text-xs text-muted-foreground">{formatTimeAgo(r.lastModified)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── McpTab ───

function McpTab({ servers }: { servers: McpServer[] }): React.JSX.Element {
  if (servers.length === 0) {
    return <p className="text-xs text-muted-foreground">등록된 MCP 서버가 없습니다</p>;
  }
  return (
    <div className="space-y-2">
      {servers.map((s) => (
        <div key={s.name} className="rounded-md border border-border/50 px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <Plug className="h-4 w-4 text-accent-green" />
            <span className="text-sm font-semibold text-foreground">{s.name}</span>
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            <span>{s.command}</span>
            {s.args.length > 0 && <span className="ml-1">{s.args.join(' ')}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── PermissionsTab ───

function PermissionsTab({ allow, deny }: { allow: string[]; deny: string[] }): React.JSX.Element {
  if (allow.length === 0 && deny.length === 0) {
    return <p className="text-xs text-muted-foreground">퍼미션 설정이 없습니다</p>;
  }
  return (
    <div className="space-y-4">
      {allow.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-accent-green mb-2">Allow ({allow.length})</h3>
          <div className="flex flex-wrap gap-1.5">
            {allow.map((p, i) => (
              <span
                key={i}
                className="inline-flex rounded bg-accent-green/10 text-accent-green px-2 py-0.5 text-xs font-mono"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
      {deny.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-destructive mb-2">Deny ({deny.length})</h3>
          <div className="flex flex-wrap gap-1.5">
            {deny.map((p, i) => (
              <span
                key={i}
                className="inline-flex rounded bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-mono"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NotificationsTab ───

const NOTIFICATION_TRIGGERS: {
  key: keyof NotificationSettings;
  label: string;
  description: string;
}[] = [
  { key: 'budgetAlert', label: '비용 임계', description: '일/월 예산의 설정 비율 도달 시 알림' },
  {
    key: 'docChange',
    label: '문서 변경',
    description: 'blocking/important 중요도 문서 변경 시 알림',
  },
  {
    key: 'sessionLifecycle',
    label: '세션 시작/종료',
    description: 'Claude Code 세션 시작/종료 감지 시 알림',
  },
  {
    key: 'taskComplete',
    label: '태스크 완료',
    description: '태스크 상태가 completed로 변경 시 알림',
  },
  {
    key: 'agentStuck',
    label: '에이전트 stuck',
    description: '활성 세션이 15분 이상 무활동 상태일 때 알림',
  },
  {
    key: 'uncommittedChanges',
    label: '대규모 미커밋',
    description: '프로젝트에 50개 이상 미커밋 변경이 있을 때 알림 (1시간당 1회)',
  },
  {
    key: 'zombieProcess',
    label: '좀비 세션',
    description: '세션 json 파일은 있으나 pid 프로세스가 종료된 경우 알림',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  budget: '비용',
  'doc-change': '문서',
  'session-lifecycle': '세션',
  'task-complete': '태스크',
  'agent-stuck': 'Stuck',
  'uncommitted-changes': '미커밋',
  'zombie-process': '좀비',
};

function NotificationHistoryPanel(): React.JSX.Element {
  const [entries, setEntries] = useState<NotificationHistoryEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const h = await window.api?.getNotificationHistory?.();
      if (h && isMountedRef.current) setEntries(h.entries);
    } catch {
      // 무음
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHistory();
  }, [loadHistory]);

  const handleMarkRead = useCallback(
    async (id: string) => {
      await window.api?.markNotificationRead?.(id);
      loadHistory();
    },
    [loadHistory]
  );

  const handleClear = useCallback(async () => {
    await window.api?.clearNotificationHistory?.();
    if (isMountedRef.current) setEntries([]);
  }, []);

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.category === filter);

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">알림 이력</h3>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
          >
            <option value="all">전체</option>
            <option value="budget">비용</option>
            <option value="doc-change">문서</option>
            <option value="session-lifecycle">세션</option>
            <option value="task-complete">태스크</option>
          </select>
          {entries.length > 0 && (
            <button
              onClick={handleClear}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              이력 지우기
            </button>
          )}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">알림 이력이 없습니다</p>
      ) : (
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {filtered.slice(0, 50).map((entry) => (
            <div
              key={entry.id}
              className={`flex items-start justify-between rounded border px-2.5 py-1.5 text-xs ${
                entry.read ? 'border-border/30 opacity-60' : 'border-border/50'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-muted px-1 py-0.5 text-[10px] font-medium">
                    {CATEGORY_LABELS[entry.category] ?? entry.category}
                  </span>
                  <span className="font-medium text-foreground">{entry.title}</span>
                </div>
                <p className="mt-0.5 truncate text-muted-foreground">{entry.body}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatTimeAgo(entry.timestamp)}
                </p>
              </div>
              {!entry.read && (
                <button
                  onClick={() => handleMarkRead(entry.id)}
                  className="ml-2 shrink-0 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  읽음
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationsTab(): React.JSX.Element {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    window.api?.getNotificationSettings?.()?.then((s) => {
      if (isMountedRef.current) setSettings(s);
    });
  }, []);

  const handleToggle = useCallback(
    async (key: keyof NotificationSettings) => {
      if (!settings) return;
      const next = { ...settings, [key]: !settings[key] };
      try {
        const saved = await window.api?.setNotificationSettings?.(next);
        if (saved && isMountedRef.current) {
          setSettings(saved);
          setSavedAt(Date.now());
        }
      } catch {
        // 무음
      }
    },
    [settings]
  );

  if (!settings) {
    return <p className="text-xs text-muted-foreground">알림 설정을 불러오는 중...</p>;
  }

  return (
    <div className="space-y-3">
      {NOTIFICATION_TRIGGERS.map(({ key, label, description }) => (
        <div
          key={key}
          className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2.5"
        >
          <div>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <button
            onClick={() => handleToggle(key)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              settings[key] ? 'bg-accent-green' : 'bg-muted'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                settings[key] ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      ))}
      {savedAt && (
        <p className="text-xs text-accent-green">
          저장됨 ({new Date(savedAt).toLocaleTimeString()})
        </p>
      )}
      <NotificationHistoryPanel />
    </div>
  );
}

// ─── ProjectsTab ───

function ProjectsTab(): React.JSX.Element {
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [known, setKnown] = useState<KnownProject[] | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    Promise.all([
      window.api?.getProjectSettings?.() ?? Promise.resolve(null),
      window.api?.getKnownProjects?.() ?? Promise.resolve([]),
    ])
      .then(([s, k]) => {
        if (!isMountedRef.current) return;
        setSettings(s);
        setKnown(k);
      })
      .catch((e) => {
        if (isMountedRef.current) {
          setError(e instanceof Error ? e.message : '프로젝트 설정 로드 실패');
        }
      });
  }, []);

  const handleChange = useCallback(
    async (value: string) => {
      const next: ProjectSettings = {
        currentProjectPath: value === '' ? null : value,
      };
      try {
        const saved = await window.api?.setProjectSettings?.(next);
        if (!isMountedRef.current) return;
        if (saved) {
          setSettings(saved);
          setSavedAt(Date.now());
          setError(null);
        }
      } catch (e) {
        if (isMountedRef.current) {
          setError(e instanceof Error ? e.message : '저장 실패');
        }
      }
    },
    []
  );

  if (!settings || !known) {
    return <p className="text-xs text-muted-foreground">프로젝트 설정을 불러오는 중...</p>;
  }

  return (
    <div className="space-y-4" data-testid="config-projects-tab">
      <div className="rounded-md border border-border/50 p-3 space-y-2">
        <div>
          <p className="text-sm font-medium text-foreground">현재 프로젝트</p>
          <p className="text-xs text-muted-foreground">
            Skills/Agents/Config 페이지가 스캔할 프로젝트를 선택합니다. "자동 감지"를 선택하면
            history.jsonl의 가장 최근 활동 프로젝트를 사용합니다.
          </p>
        </div>
        <select
          data-testid="current-project-select"
          value={settings.currentProjectPath ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
        >
          <option value="">— 자동 감지 (history.jsonl 최신) —</option>
          {known.map((p) => (
            <option key={p.path} value={p.path}>
              {p.path}
            </option>
          ))}
        </select>
        {savedAt && (
          <p className="text-xs text-accent-green">
            저장됨 ({new Date(savedAt).toLocaleTimeString()})
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

// ─── ConfigPage ───

export function ConfigPage(): React.JSX.Element {
  const [config, setConfig] = useState<ConfigSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('hooks');
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
        const result = await window.api?.getConfigSummary?.();
        if (!result) throw new Error('preload API를 사용할 수 없습니다');
        if (isMountedRef.current) setConfig(result);
      } catch (err) {
        if (isMountedRef.current) setError(err instanceof Error ? err.message : '설정 조회 실패');
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-3 p-6" data-testid="page-config">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-destructive" data-testid="page-config">
        <p>설정을 불러올 수 없습니다: {error}</p>
      </div>
    );
  }

  if (!config) return <div data-testid="page-config" />;

  const tabCounts: Record<TabId, number> = {
    hooks: config.hooks.length,
    rules: config.rules.length,
    mcp: config.mcpServers.length,
    permissions: config.permissionsAllow.length + config.permissionsDeny.length,
    notifications: 7,
    projects: 1,
  };

  return (
    <div className="flex h-full flex-col" data-testid="page-config">
      {/* 헤더 + 탭 */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Config 모니터</h1>
        </div>
        <div className="flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              data-testid={`config-tab-${id}`}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${
                activeTab === id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent/30'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              <span className="ml-0.5 opacity-70">({tabCounts[id]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* 탭 본문 */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'hooks' && <HooksTab hooks={config.hooks} />}
        {activeTab === 'rules' && <RulesTab rules={config.rules} />}
        {activeTab === 'mcp' && <McpTab servers={config.mcpServers} />}
        {activeTab === 'permissions' && (
          <PermissionsTab allow={config.permissionsAllow} deny={config.permissionsDeny} />
        )}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'projects' && <ProjectsTab />}
      </div>
    </div>
  );
}
