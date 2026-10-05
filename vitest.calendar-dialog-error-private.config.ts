import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// Private preparation selection: frozen Svelte SSR host, no DOM or browser shims.
export default defineConfig({
  plugins: [svelte({ configFile: false })],
  test: { environment: 'node', fileParallelism: false,
    include: ['tests/calendar-dialog-error-private/*.test.ts'] },
});
