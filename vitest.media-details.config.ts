import {defineConfig} from 'vitest/config';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {resolve} from 'node:path';
export default defineConfig({plugins:[svelte({configFile:false})],resolve:{alias:{'$app/paths':resolve(import.meta.dirname,'tests/helpers/media-client-paths.ts')}},test:{include:['tests/media-details-native/*.test.ts'],fileParallelism:false}});
