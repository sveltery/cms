import adapter from '@sveltejs/adapter-auto';
import node from '@sveltejs/adapter-node';
import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { sourceSeedPlugin } from './scripts/source-seed-vite.ts';

const cloudflare = process.env.SVELTERY_ADAPTER === 'cloudflare' ?
  (await import('@sveltejs/adapter-cloudflare')).default : undefined;

export default defineConfig({
  plugins: [
    sourceSeedPlugin(),
    ...(process.env.SVELTERY_ADAPTER === 'cloudflare' ? [{
      name: 'sveltery-cloudflare-storage', enforce: 'pre' as const,
      resolveId(source: string, importer?: string) {
        if (source === './node.ts' && importer?.endsWith('/runtime/composition.ts')) {
          return fileURLToPath(new URL('./src/lib/server/runtime/node-cloudflare.ts', import.meta.url));
        }
      }
    }] : []),
    sveltekit({
    preprocess: vitePreprocess(),
    compilerOptions: { experimental: { async: true } },
    adapter: process.env.SVELTERY_ADAPTER === 'node' ? node({ out: 'build/node' }) :
      process.env.SVELTERY_ADAPTER === 'cloudflare' ? cloudflare!({ config: 'wrangler.jsonc', platformProxy: { configPath: 'wrangler.jsonc' } }) : adapter(),
    experimental: { remoteFunctions: true }
  })]
});
