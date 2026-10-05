import {defineConfig} from 'vitest/config';
import {resolve} from 'node:path';
export default defineConfig({resolve:{alias:{'$env/dynamic/private':resolve(import.meta.dirname,'tests/helpers/media-hosting-env.ts')}},test:{include:['tests/media-storage-native/*.test.ts'],fileParallelism:false}});
