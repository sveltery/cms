// Owned TEST-ONLY isolated account-component SSR build. All actual API/remote
// handlers/hooks remain the production routes; only setup page presentation is
// replaced by the complete real existing account component host.
import adapter from '@sveltejs/adapter-auto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { sourceSeedPlugin } from './scripts/source-seed-vite.ts';
const page = fileURLToPath(new URL('./src/routes/setup/+page.svelte', import.meta.url));
const host = fileURLToPath(new URL('./tests/helpers/default-seed-setup/account-component-ssr-host.svelte', import.meta.url));
export default defineConfig({ plugins: [
  sourceSeedPlugin(),
  { name: 'test-only-real-account-component-host', enforce: 'pre',
    async load(id) { if (id.split('?')[0] === page) return readFile(host, 'utf8'); } },
  sveltekit({ preprocess: vitePreprocess(),
    compilerOptions: { experimental: { async: true } },
    adapter: adapter(), experimental: { remoteFunctions: true },
    outDir: 'tests/.default-seed-account-ssr' })
] });
