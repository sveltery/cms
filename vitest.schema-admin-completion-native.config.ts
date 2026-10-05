import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';
const root = import.meta.dirname;
export default defineConfig({
  plugins: [svelte({ configFile: false })],
  resolve: { conditions: ['browser'], alias: { '$lib/schema.remote': resolve(root, 'tests/schema-admin-completion/native/remote-descriptors.ts') } },
  test: { environment: 'jsdom', fileParallelism: false, include: ['tests/schema-admin-completion/native/forms.test.ts'] }
});
