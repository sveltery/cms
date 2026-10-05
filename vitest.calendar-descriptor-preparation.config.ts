// Private controlled display preparation; not part of any published gate.
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({ plugins: [svelte({ configFile: false }), {
  name: 'calendar-descriptor-controlled-base', enforce: 'pre',
  resolveId(id) { if (id === '$app/paths') return '\0calendar-descriptor-base'; },
  load(id) { if (id === '\0calendar-descriptor-base') return "export const base='';"; }
}], test: { environment: 'node', fileParallelism: false,
  include: ['tests/calendar-descriptor-preparation/*.test.ts'] } });
