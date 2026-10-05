import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';
const root = import.meta.dirname;
export default defineConfig({
 plugins: [svelte({ configFile: false, compilerOptions: { experimental: { async: true } } })],
 resolve: { conditions: ['browser'], alias: [
  { find: '$app/state', replacement: resolve(root, 'tests/helpers/admin-app/page.ts') },
  { find: '$lib/workspace.remote', replacement: resolve(root, 'tests/helpers/admin-app/navigation.ts') },
  { find: '$lib', replacement: resolve(root, 'src/lib') }
 ] },
 test: { server: { deps: { inline: ['svelte'] } }, environment: 'jsdom', fileParallelism: false, include: ['tests/admin-app-native/*.test.ts'] }
});
