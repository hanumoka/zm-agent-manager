import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import App from '../App';

/**
 * App 마운트 시 DashboardPage가 `window.api`의 비동기 호출을 수행하므로
 * act() 경고 방지를 위해 stub + waitFor로 후속 상태 업데이트까지 기다린다.
 */
const stubApi = {
  getSessions: vi.fn().mockResolvedValue([]),
  parseSession: vi.fn().mockResolvedValue(null),
  watchSession: vi.fn().mockResolvedValue(undefined),
  unwatchSession: vi.fn().mockResolvedValue(undefined),
  getAllTasks: vi.fn().mockResolvedValue({ tasks: [] }),
  getCostSummary: vi.fn().mockResolvedValue({
    totalCost: 0,
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    byModel: [],
    byDay: [],
  }),
  getSessionSubagents: vi.fn().mockResolvedValue([]),
  getProjectDocs: vi.fn().mockResolvedValue([]),
  searchSessions: vi.fn().mockResolvedValue({ query: '', results: [], totalMatches: 0 }),
  getBudgetSettings: vi.fn().mockResolvedValue({
    dailyUsd: null,
    monthlyUsd: null,
    alertPercent: 80,
    lastNotifiedKeys: [],
  }),
  setBudgetSettings: vi.fn().mockResolvedValue(undefined),
  getStatsSummary: vi.fn().mockResolvedValue({
    totalSessions: 0,
    totalMessages: 0,
    totalTokens: 0,
    totalToolCalls: 0,
    dailyActivity: [],
    heatmap: [],
    byProject: [],
    byModel: [],
  }),
  getSkills: vi.fn().mockResolvedValue([]),
  onNewRecords: vi.fn().mockReturnValue(() => {}),
};

const win = window as unknown as { api: typeof stubApi };

beforeEach(() => {
  win.api = stubApi;
  for (const fn of Object.values(stubApi)) {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      (fn as { mockClear: () => void }).mockClear();
    }
  }
});

afterEach(() => {
  // window.api는 preload에서 주입되는 것이 정상이므로 테스트 후 제거
  delete (win as Partial<typeof win>).api;
});

describe('App', () => {
  it('renders app title', async () => {
    render(<App />);
    // 타이틀은 동기적으로 렌더
    expect(screen.getByText('zm-agent-manager')).toBeInTheDocument();
    // 비동기 DashboardPage 초기화 완료까지 대기 — act() 경고 방지
    await waitFor(() => {
      expect(stubApi.getSessions).toHaveBeenCalled();
    });
  });
});
