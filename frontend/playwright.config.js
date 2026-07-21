import { defineConfig, devices } from '@playwright/test'

// タベマップ フロントエンドの E2E 設定。
// - テストは ./e2e に配置
// - webServer で Vite 開発サーバー(5173)を自動起動する（既に起動済みなら再利用）
// - API はスペック側で page.route によりモックするため、バックエンド無しでも実行できる
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // モバイル前提の UI のため、スマホ相当のプロファイルも用意（必要に応じて有効化）
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
