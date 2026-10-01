import { defineConfig, devices } from '@playwright/test';

const nodeTarget = process.env.SVELTERY_BROWSER_TARGET === 'node';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  globalTimeout: 120_000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    launchOptions: { chromiumSandbox: true, timeout: 30_000 }
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Own the Vite process directly so teardown cannot leave pnpm's child running.
    command: nodeTarget ? 'exec node build/node/index.js'
      : 'exec node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort',
    ...(nodeTarget ? { env: { HOST: '127.0.0.1', PORT: '4173', ORIGIN: 'http://127.0.0.1:4173' } } : {}),
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 30_000
  }
});
