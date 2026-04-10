import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { join } from 'path';

/**
 * 사이드바 네비게이션 smoke test
 * - 앱이 정상 부팅되는지
 * - 11개 사이드바 항목 클릭으로 모든 페이지 로드되는지
 */

let app: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  app = await electron.launch({
    args: [join(__dirname, '..', 'out', 'main', 'index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });
  window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await app?.close();
});

test('앱이 사이드바와 함께 로드된다', async () => {
  await expect(window.getByTestId('sidebar')).toBeVisible();
});

test('Dashboard 페이지로 이동한다', async () => {
  await window.getByTestId('nav-dashboard').click();
  await expect(window.getByTestId('page-dashboard')).toBeVisible({ timeout: 10_000 });
});

test('Sessions 페이지로 이동한다', async () => {
  await window.getByTestId('nav-sessions').click();
  await expect(window.getByTestId('page-sessions')).toBeVisible({ timeout: 10_000 });
});

test('Tasks 페이지로 이동한다', async () => {
  await window.getByTestId('nav-tasks').click();
  await expect(window.getByTestId('page-tasks')).toBeVisible({ timeout: 15_000 });
});

test('Stats 페이지로 이동한다', async () => {
  await window.getByTestId('nav-stats').click();
  await expect(window.getByTestId('page-stats')).toBeVisible({ timeout: 15_000 });
});

test('Compare 페이지로 이동한다', async () => {
  await window.getByTestId('nav-compare').click();
  await expect(window.getByTestId('page-compare')).toBeVisible({ timeout: 10_000 });
});

test('Costs 페이지로 이동한다', async () => {
  await window.getByTestId('nav-costs').click();
  await expect(window.getByTestId('page-costs')).toBeVisible({ timeout: 15_000 });
});

test('Docs 페이지로 이동한다', async () => {
  await window.getByTestId('nav-docs').click();
  await expect(window.getByTestId('page-docs')).toBeVisible({ timeout: 10_000 });
});

test('Skills 페이지로 이동한다', async () => {
  await window.getByTestId('nav-skills').click();
  await expect(window.getByTestId('page-skills')).toBeVisible({ timeout: 10_000 });
});

test('Agents 페이지로 이동한다', async () => {
  await window.getByTestId('nav-agents').click();
  await expect(window.getByTestId('page-agents')).toBeVisible({ timeout: 10_000 });
});

test('Memory 페이지로 이동한다', async () => {
  await window.getByTestId('nav-memory').click();
  await expect(window.getByTestId('page-memory')).toBeVisible({ timeout: 10_000 });
});

test('Search 페이지로 이동한다', async () => {
  await window.getByTestId('nav-search').click();
  await expect(window.getByTestId('page-search')).toBeVisible({ timeout: 10_000 });
});
