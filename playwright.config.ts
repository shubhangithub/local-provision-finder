import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 10,
  timeout: 8_000,
  expect: { timeout: 2_000 },
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8000', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    ...(process.env.PLAYWRIGHT_MOBILE ? [{ name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' as const } }] : []),
  ],
  webServer: { command: 'npm run restore:data && vite build && vite preview --host 127.0.0.1 --port 8000 --strictPort', url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8000', reuseExistingServer: true },
});
