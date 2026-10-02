import adapter from '@sveltejs/adapter-auto';
import node from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit({
    preprocess: vitePreprocess(),
    compilerOptions: { experimental: { async: true } },
    adapter: process.env.SVELTERY_ADAPTER === 'node' ? node({ out: 'build/node' }) : adapter(),
    experimental: { remoteFunctions: true }
  })]
});
