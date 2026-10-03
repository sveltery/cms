import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser', testMatch: 'passkey-setup-login.spec.ts',
  workers: 1, retries: 0, reporter: 'list',
  use: { trace: 'retain-on-failure', launchOptions: { chromiumSandbox: true,
    executablePath: process.env.CMS_AUTH_CHROME, timeout: 30_000 } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
