import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { resolve, dirname } from 'node:path';

const root = import.meta.dirname;
const frozen = resolve(root, 'parity/emdash/setup-wizard-source/upstream/packages/admin');
export default defineConfig({
  plugins: [svelte({ configFile: false }), {
    name: 'whole-setup-wizard-native-mount', enforce: 'pre',
    resolveId(id, importer) {
      if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
      const target = resolve(dirname(importer), id).replace(/\.(tsx?|js)$/, '');
      if (target === resolve(frozen, 'src/components/SetupWizard')) return resolve(root, 'tests/helpers/setup-wizard/browser-react.tsx');
      if (target === resolve(frozen, 'src/lib/api/client')) return resolve(root, 'tests/helpers/setup-wizard/source-client.ts');
    }
  }],
  resolve: { conditions: ['browser'], dedupe: ['react', 'react-dom'], alias: [
    { find: '$lib/auth.remote', replacement: resolve(root, 'tests/helpers/setup-wizard/baseline-auth-remote.ts') },
    { find: '$lib', replacement: resolve(root, 'src/lib') }
  ] },
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    globals: true, fileParallelism: false,
    include: ['parity/emdash/setup-wizard-source/upstream/packages/admin/tests/components/SetupWizard.test.tsx'],
    setupFiles: ['parity/emdash/setup-wizard-source/upstream/packages/admin/tests/setup.ts'],
    browser: {
      enabled: true, headless: true,
      provider: playwright({ contextOptions: { timezoneId: 'America/New_York' }, launchOptions: { chromiumSandbox: true, timeout: 30000 } }),
      instances: [{ browser: 'chromium' }], viewport: { width: 1280, height: 800 }
    }
  }
});
