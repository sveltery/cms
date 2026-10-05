import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({plugins:[svelte({configFile:false})],
 test:{environment:'node',fileParallelism:false,include:['tests/search-native-ui/*.test.ts']}});
