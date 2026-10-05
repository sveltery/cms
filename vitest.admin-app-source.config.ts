import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { dirname, resolve } from 'node:path';
const root = import.meta.dirname;
const frozen = resolve(root, 'parity/emdash/admin-app-source/upstream/packages/admin');
const helper = (file: string) => resolve(root, 'tests/helpers/admin-app', file);
export default defineConfig({
 plugins: [svelte({ configFile: false, compilerOptions: { experimental: { async: true } } }), {
  name: 'whole-admin-app-native-host', enforce: 'pre',
  resolveId(id, importer) {
   if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
   const target = resolve(dirname(importer), id).replace(/\.(tsx?|js)$/, '');
   if (target === resolve(frozen, 'src/components/Shell')) return helper('source-shell.tsx');
   if (target === resolve(frozen, 'tests/utils/render')) return helper('dom-render.tsx');
   if (target === resolve(frozen, 'src/lib/api/current-user')) return resolve(root, 'tests/helpers/dashboard-welcome/source-current-user.ts');
   if (target === resolve(frozen, 'src/lib/plugin-context')) return resolve(root, 'src/lib/admin-app/plugin-pages.ts');
  }
 }],
 resolve: { conditions: ['browser'], dedupe: ['react', 'react-dom'], alias: [
  { find: '$app/state', replacement: helper('page.ts') },
  { find: '$lib/workspace.remote', replacement: helper('navigation.ts') },
  { find: '$lib', replacement: resolve(root, 'src/lib') }
 ] }, oxc: { jsx: { runtime: 'automatic' } },
 test: { server: { deps: { inline: ['svelte'] } }, environment: 'jsdom', fileParallelism: false, setupFiles: ['tests/helpers/admin-app/setup.ts'],
  include: ['parity/emdash/admin-app-source/upstream/packages/admin/tests/**/*.test.*'] }
});
