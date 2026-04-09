import { defineConfig } from '@playwright/test';

/**
 * Electron E2E 테스트 설정
 *
 * 주의: dev 서버 사용 금지. 빌드 후 out/main/index.js 진입점으로 실행.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  fullyParallel: false, // Electron 인스턴스는 직렬 실행
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
