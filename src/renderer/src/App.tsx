import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, ClipboardList, DollarSign } from 'lucide-react';
import { SessionList } from '@/components/SessionList';
import { TimelinePage } from '@/components/TimelinePage';
import { DashboardPage } from '@/components/DashboardPage';
import { TaskBoard } from '@/components/TaskBoard';
import { CostTracker } from '@/components/CostTracker';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, matchPaths: ['/'] },
  {
    path: '/sessions',
    label: 'Sessions',
    icon: MessageSquare,
    matchPaths: ['/sessions', '/timeline'],
  },
  { path: '/tasks', label: 'Tasks', icon: ClipboardList, matchPaths: ['/tasks'] },
  { path: '/costs', label: 'Costs', icon: DollarSign, matchPaths: ['/costs'] },
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

function Sidebar(): React.JSX.Element {
  const location = useLocation();

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-background">
      <nav className="flex-1 space-y-1 px-2 pt-2">
        {NAV_ITEMS.map(({ path, label, icon: Icon, matchPaths }) => {
          const isActive = matchPaths.some(
            (mp) =>
              location.pathname === mp || (mp !== '/' && location.pathname.startsWith(mp + '/'))
          );

          return (
            <Link
              key={path}
              to={path}
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
              <Route path="/costs" element={<CostTracker />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  );
}

export default App;
