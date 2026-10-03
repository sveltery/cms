import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { dirname, resolve } from 'node:path';
const root = import.meta.dirname, frozen = resolve(root, 'parity/emdash/date-time-widgets/source/packages/admin');
export default defineConfig({
  plugins: [svelte({ configFile: false }), {
    name: 'whole-date-time-browser-host', enforce: 'pre',
    resolveId(specifier, importer) {
      if (!importer?.startsWith(frozen) || !specifier.startsWith('.')) return;
      const target = resolve(dirname(importer), specifier).replace(/\.(tsx?|js)$/, '');
      if (target === resolve(frozen, 'src/components/PublishingDateTimeEditor')) return resolve(root, 'tests/helpers/date-time/react-bridge.ts');
      if (target === resolve(frozen, 'tests/utils/render')) return resolve(root, 'tests/helpers/date-time/browser-render.ts');
      if (target === resolve(frozen, 'src/lib/publishing-datetime')) return resolve(root, 'src/lib/ui/publishing-datetime.ts');
      if (target === resolve(frozen, 'src/lib/datetime-local')) return resolve(root, 'src/lib/ui/datetime-local.ts');
    }
  }],
  resolve: { alias: {
    'date-time-reference/nav': resolve(root, 'parity/emdash/date-time-widgets/calendar-reference/dist/esm/components/Nav.js'),
    'date-time-reference/previous': resolve(root, 'parity/emdash/date-time-widgets/calendar-reference/dist/esm/components/PreviousMonthButton.js'),
    'date-time-reference/next': resolve(root, 'parity/emdash/date-time-widgets/calendar-reference/dist/esm/components/NextMonthButton.js'),
    'date-time-reference/context': resolve(root, 'parity/emdash/date-time-widgets/calendar-reference/dist/esm/useDayPicker.js')
  } }, oxc: { jsx: { runtime: 'automatic' } },
  test: { fileParallelism: false, setupFiles: ['tests/helpers/date-time/browser-setup.ts'], include: [
    'parity/emdash/date-time-widgets/source/packages/admin/tests/components/PublishingDateTimeEditor.test.tsx',
    'parity/emdash/date-time-widgets/source/packages/admin/tests/lib/*.test.ts',
    'tests/date-time-native/*.test.ts'
  ], browser: { enabled: true, headless: true,
    provider: playwright({ launchOptions: { chromiumSandbox: true, timeout: 30_000 }, contextOptions: { timezoneId: 'America/New_York' } }),
    instances: [{ browser: 'chromium' }], viewport: { width: 1280, height: 800 }
  } }
});
