import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
  (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3000',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] },
    screenshot: 'only-on-failure',
    trace: 'off',
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run start',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
