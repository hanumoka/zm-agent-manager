import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { join } from 'path';

/**
 * Workflow 페이지 + WorkflowManager 모달 smoke test (INBOX #13).
 *
 * 검증 항목:
 * - Workflow 페이지 진입 + 기본 렌더
 * - Manage 버튼 → CRUD 모달 오픈
 * - New 버튼으로 에디터 초기화
 * - 검증 실패 케이스 — 잘못된 입력 시 에러 인라인 표시
 * - 모달 닫기
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
  await window.getByTestId('nav-workflow').click();
  await expect(window.getByTestId('page-workflow')).toBeVisible({ timeout: 15_000 });
});

test.afterAll(async () => {
  await app?.close();
});

test('Workflow 페이지에 프로젝트 드롭다운이 표시된다', async () => {
  await expect(window.getByTestId('workflow-project-select')).toBeVisible();
});

test('Manage 버튼 클릭으로 모달이 열린다', async () => {
  const manageButton = window.getByTestId('workflow-manage-button');
  if (!(await manageButton.isVisible())) {
    test.skip(true, '알려진 프로젝트가 없어 Manage 버튼 미표시 — 환경 의존');
  }
  await manageButton.click();
  await expect(window.getByTestId('workflow-manager-modal')).toBeVisible();
});

test('New 버튼으로 에디터가 초기화된다', async () => {
  const modal = window.getByTestId('workflow-manager-modal');
  if (!(await modal.isVisible())) {
    test.skip(true, '이전 테스트에서 모달 미오픈');
  }
  await window.getByTestId('workflow-manager-new').click();
  await expect(window.getByTestId('workflow-editor-name')).toBeVisible();
  const nameInput = window.getByTestId('workflow-editor-name');
  await expect(nameInput).toHaveValue(/new-workflow/);
});

test('검증 실패 케이스 — name을 비우면 검증 에러 표시', async () => {
  const modal = window.getByTestId('workflow-manager-modal');
  if (!(await modal.isVisible())) {
    test.skip(true, '모달 미오픈');
  }
  const nameInput = window.getByTestId('workflow-editor-name');
  await nameInput.click();
  await nameInput.press('Control+A');
  await nameInput.press('Delete');
  await window.getByTestId('workflow-editor-save').click();
  await expect(window.getByTestId('workflow-editor-errors')).toBeVisible({
    timeout: 5_000,
  });
});

test('닫기 버튼으로 모달이 닫힌다', async () => {
  const modal = window.getByTestId('workflow-manager-modal');
  if (!(await modal.isVisible())) {
    test.skip(true, '모달 미오픈');
  }
  await window.getByTestId('workflow-manager-close').click();
  await expect(window.getByTestId('workflow-manager-modal')).not.toBeVisible();
});
