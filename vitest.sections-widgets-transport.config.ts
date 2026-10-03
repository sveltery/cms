import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  plugins: [
    { name: 'explicit-cms-framework-base-fixture', resolveId(id) { if (id === '$app/paths') return '\0sections-widgets-native-paths'; },
      load(id) { if (id === '\0sections-widgets-native-paths') return "export const base = '/cms';"; } },
    svelte({ configFile: false })
  ],
  resolve: { alias: { $lib: resolve(root, 'src/lib') }, conditions: ['node'] },
  test: { environment: 'node', include: ['tests/sections-widgets/base-path.test.ts'] }
});
