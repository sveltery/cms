import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// Mounted production field, caller-controlled values; no browser/protected transport.
export default defineConfig({ plugins: [svelte({ configFile: false })],
  resolve: { conditions: ['browser'] },
  test: { environment: 'jsdom', fileParallelism: false,
    include: ['tests/calendar-shared-picker-labels/*.dom.ts'] },
});
