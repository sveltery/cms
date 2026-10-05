import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
export default defineConfig({ plugins: [svelte({ configFile: false }), {
  name: 'prepared-calendar-picker-controlled-kit-base', enforce: 'pre',
  resolveId(id) { if (id === '$app/paths') return '\0prepared-calendar-picker-base'; },
  load(id) { if (id === '\0prepared-calendar-picker-base') return "export const base='';"; },
}], resolve: { conditions: ['browser'] }, test: {
  include: ['tests/calendar-picker-keyboard-browser/*.test.ts'], fileParallelism: false,
  browser: { enabled: true, headless: true,
    provider: playwright({ contextOptions: { timezoneId: 'America/New_York' }, launchOptions: { chromiumSandbox: true, timeout: 30000 } }),
    instances: [{ browser: 'chromium' }], viewport: { width: 1280, height: 800 },
  },
} });
