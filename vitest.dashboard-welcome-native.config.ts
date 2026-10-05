import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const root = import.meta.dirname;
export default defineConfig({
  plugins: [svelte({ configFile: false }), {
    name: 'native-dashboard-test-first-existing-main-fallback', enforce: 'pre',
    resolveId(id, importer) {
      if (!importer?.includes('/tests/dashboard-welcome-native/') || !id.endsWith('.svelte')) return;
      const target = resolve(dirname(importer), id);
      if (!existsSync(target)) return resolve(root, 'src/lib/ui/DraftPreview.svelte');
    }
  }],
  resolve: { conditions: ['browser'] },
  test: { environment: 'jsdom', fileParallelism: false, include: ['tests/dashboard-welcome-native/*.test.ts'] }
});
