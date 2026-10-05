import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { dirname, resolve } from 'node:path';

const root = import.meta.dirname;
const frozen = resolve(root, 'parity/emdash/dashboard-welcome-source/upstream/packages/admin');
const helper = (file: string) => resolve(root, 'tests/helpers/dashboard-welcome', file);
export default defineConfig({
  plugins: [svelte({ configFile: false }), {
    name: 'whole-dashboard-welcome-native-dom-host', enforce: 'pre',
    resolveId(id, importer) {
      if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
      const target = resolve(dirname(importer), id).replace(/\.(tsx?|js)$/, '');
      if (target === resolve(frozen, 'src/components/Dashboard') || target === resolve(frozen, 'src/components/WelcomeModal')) return helper('source-react.tsx');
      if (target === resolve(frozen, 'tests/utils/render')) return helper('dom-render.tsx');
      if (target === resolve(frozen, 'src/lib/api/dashboard')) return helper('source-dashboard.ts');
      if (target === resolve(frozen, 'src/lib/api/transfer')) return helper('source-transfer.ts');
      if (target === resolve(frozen, 'src/lib/api/current-user')) return helper('source-current-user.ts');
      if (target === resolve(frozen, 'src/lib/api/client')) return helper('source-client.ts');
    }
  }],
  resolve: { conditions: ['browser'], dedupe: ['react', 'react-dom'] },
  oxc: { jsx: { runtime: 'automatic' } },
  test: { environment: 'jsdom', fileParallelism: false,
    setupFiles: ['tests/helpers/dashboard-welcome/dom-setup.ts'],
    include: ['parity/emdash/dashboard-welcome-source/upstream/packages/admin/tests/components/*.test.tsx'] }
});
