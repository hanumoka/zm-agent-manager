import { HashRouter, Routes, Route } from 'react-router-dom';
import { Button } from '@/components/ui/button';

function Dashboard(): React.JSX.Element {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary">zm-agent-manager</h1>
        <p className="mt-2 text-muted-foreground">Claude Code 세션 모니터링 데스크톱 앱</p>
        <Button className="mt-4" variant="default">
          시작하기
        </Button>
      </div>
    </div>
  );
}

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
