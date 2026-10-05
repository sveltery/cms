import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';
export default defineConfig({ plugins: [svelte({ configFile: false })], resolve: { alias: { $lib: resolve(import.meta.dirname, 'src/lib') }, conditions: ['browser'] },
  test: { environment: 'jsdom', fileParallelism: false, include: ['tests/rich-editor-native/*.test.ts'] } });
