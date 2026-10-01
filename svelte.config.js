import adapter from '@sveltejs/adapter-auto';
import node from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  compilerOptions: { experimental: { async: true } },
  kit: {
    adapter: process.env.SVELTERY_ADAPTER === 'node' ? node({ out: 'build/node' }) : adapter(),
    experimental: { remoteFunctions: true }
  }
};
