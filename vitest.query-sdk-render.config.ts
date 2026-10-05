import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({
  plugins: [svelte({configFile: false, compilerOptions: {experimental: {async: true}}})],
  test: {environment: 'node', fileParallelism: false, include: ['tests/query-sdk-render/*.test.ts']}
});
