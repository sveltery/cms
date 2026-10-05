import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve, dirname } from 'node:path';
const root = import.meta.dirname;
const frozen = resolve(root, 'parity/emdash/scheduled-publishing-source/upstream/packages/admin');
export default defineConfig({
  plugins: [svelte({ configFile: false }), {
    name: 'whole-calendar-admin-pure-native-host', enforce: 'pre',
    resolveId(id, importer) {
      if (id === '$app/paths') return '\0calendar-admin-base';
      if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
      const target = resolve(dirname(importer), id).replace(/\.(tsx?|js)$/, '');
      if (target === resolve(frozen, 'src/lib/calendar')) return resolve(root, 'src/lib/calendar/calendar.ts');
      if (target === resolve(frozen, 'src/lib/api/calendar')) return resolve(root, 'src/lib/calendar/api.ts');
    },
    load(id) { if (id === '\0calendar-admin-base') return "export const base = '';"; }
  }],
  test: { environment: 'node', fileParallelism: false,
    setupFiles: ['tests/helpers/calendar/node-setup.ts'],
    include: ['parity/emdash/scheduled-publishing-source/upstream/packages/admin/tests/lib/calendar.test.ts', 'tests/calendar-admin-native/*.test.ts'] }
});
