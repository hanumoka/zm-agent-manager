import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  ClipboardList,
  DollarSign,
  FileText,
  Search,
  BarChart3,
  GitCompare,
  Zap,
  Brain,
  Users,
  Settings,
} from 'lucide-react';
import { SessionList } from '@/components/SessionList';
import { TimelinePage } from '@/components/TimelinePage';
import { DashboardPage } from '@/components/DashboardPage';
import { TaskBoard } from '@/components/TaskBoard';
import { CostTracker } from '@/components/CostTracker';
import { DocInventory } from '@/components/DocInventory';
import { SearchPage } from '@/components/SearchPage';
import { StatsPage } from '@/components/StatsPage';
import { ComparePage } from '@/components/ComparePage';
import { SkillsPage } from '@/components/SkillsPage';
import { MemoryPage } from '@/components/MemoryPage';
import { AgentsPage } from '@/components/AgentsPage';
import { ConfigPage } from '@/components/ConfigPage';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, matchPaths: ['/'] },
  {
    path: '/sessions',
    label: 'Sessions',
    icon: MessageSquare,
    matchPaths: ['/sessions', '/timeline'],
  },
  { path: '/tasks', label: 'Tasks', icon: ClipboardList, matchPaths: ['/tasks'] },
  { path: '/stats', label: 'Stats', icon: BarChart3, matchPaths: ['/stats'] },
  { path: '/compare', label: 'Compare', icon: GitCompare, matchPaths: ['/compare'] },
  { path: '/costs', label: 'Costs', icon: DollarSign, matchPaths: ['/costs'] },
  { path: '/docs', label: 'Docs', icon: FileText, matchPaths: ['/docs'] },
  { path: '/skills', label: 'Skills', icon: Zap, matchPaths: ['/skills'] },
  { path: '/agents', label: 'Agents', icon: Users, matchPaths: ['/agents'] },
  { path: '/memory', label: 'Memory', icon: Brain, matchPaths: ['/memory'] },
  { path: '/config', label: 'Config', icon: Settings, matchPaths: ['/config'] },
  { path: '/search', label: 'Search', icon: Search, matchPaths: ['/search'] },
] as const;

function TitleBar(): React.JSX.Element {
  return (
    <div
      className="flex h-11 shrink-0 items-center border-b border-border bg-background pl-[78px]"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <h1 className="text-xs font-semibold text-muted-foreground">zm-agent-manager</h1>
    </div>
  );
}

interface SidebarItemSetting {
  path: string;
  visible: boolean;
  order: number;
}

function Sidebar(): React.JSX.Element {
  const location = useLocation();
  const [settings, setSettings] = useState<SidebarItemSetting[]>([]);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    window.api?.getSidebarSettings?.()?.then((s) => {
      if (s?.items?.length > 0) setSettings(s.items);
    });
  }, []);

  const visibleItems = useMemo(() => {
    if (settings.length === 0) return [...NAV_ITEMS];

    const settingsMap = new Map(settings.map((s) => [s.path, s]));
    return [...NAV_ITEMS]
      .filter((item) => {
        const s = settingsMap.get(item.path);
        return s ? s.visible : true;
      })
      .sort((a, b) => {
        const sa = settingsMap.get(a.path);
        const sb = settingsMap.get(b.path);
        return (sa?.order ?? 99) - (sb?.order ?? 99);
      });
  }, [settings]);

  const handleToggle = useCallback(
    async (path: string) => {
      const current = settings.length > 0
        ? settings
        : NAV_ITEMS.map((item, i) => ({ path: item.path, visible: true, order: i }));

      const updated = current.map((s) =>
        s.path === path ? { ...s, visible: !s.visible } : s
      );
      setSettings(updated);
      await window.api?.setSidebarSettings?.({ items: updated });
    },
    [settings]
  );

  return (
    <aside
      className="flex w-60 flex-col border-r border-border bg-background"
      data-testid="sidebar"
    >
      <nav className="flex-1 space-y-1 px-2 pt-2">
        {editMode
          ? NAV_ITEMS.map(({ path, label, icon: Icon }) => {
              const s = settings.find((s) => s.path === path);
              const isVisible = s ? s.visible : true;
              return (
                <button
                  key={path}
                  onClick={() => handleToggle(path)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isVisible
                      ? 'text-foreground'
                      : 'text-muted-foreground/40 line-through'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  <span className="ml-auto text-[10px]">{isVisible ? '표시' : '숨김'}</span>
                </button>
              );
            })
          : visibleItems.map(({ path, label, icon: Icon, matchPaths }) => {
              const isActive = matchPaths.some(
                (mp) =>
                  location.pathname === mp ||
                  (mp !== '/' && location.pathname.startsWith(mp + '/'))
              );

              return (
                <Link
                  key={path}
                  to={path}
                  data-testid={`nav-${label.toLowerCase()}`}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
      </nav>
      <div className="border-t border-border px-2 py-2">
        <button
          onClick={() => setEditMode((p) => !p)}
          className={`w-full rounded-md px-3 py-1.5 text-xs transition-colors ${
            editMode
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent'
          }`}
        >
          {editMode ? '완료' : '메뉴 편집'}
        </button>
      </div>
    </aside>
  );
}

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <div className="flex h-screen flex-col bg-background text-foreground">
        <TitleBar />
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/sessions" element={<SessionList />} />
              <Route path="/timeline/:projectEncoded/:sessionId" element={<TimelinePage />} />
              <Route path="/tasks" element={<TaskBoard />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/costs" element={<CostTracker />} />
              <Route path="/docs" element={<DocInventory />} />
              <Route path="/skills" element={<SkillsPage />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/memory" element={<MemoryPage />} />
              <Route path="/config" element={<ConfigPage />} />
              <Route path="/search" element={<SearchPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  );
}

export default App;
