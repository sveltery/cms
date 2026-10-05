import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// Supplemental pure / actual Svelte SSR controls; not original Source callbacks.
export default defineConfig({ plugins: [svelte({ configFile: false })],
  test: { environment: 'node', fileParallelism: false,
    include: ['tests/calendar-shared-picker-labels/*.test.ts'] },
});
