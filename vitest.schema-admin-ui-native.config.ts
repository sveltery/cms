import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';
export default defineConfig({plugins:[svelte({configFile:false})],resolve:{conditions:['browser'],alias:{
  '$app/paths':resolve(import.meta.dirname,'tests/helpers/schema-ui/kit-paths.ts'),
  '$app/state':resolve(import.meta.dirname,'tests/helpers/schema-ui/kit-state.svelte.ts'),
  '$lib':resolve(import.meta.dirname,'src/lib')
}},test:{environment:'jsdom',include:['tests/schema-admin-ui/*.test.ts']}});
