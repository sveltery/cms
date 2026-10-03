import {defineConfig} from 'vitest/config';
import {resolve} from 'node:path';
export default defineConfig({resolve:{alias:{'$app/paths':resolve(import.meta.dirname,'tests/helpers/media-client-paths.ts')}},test:{include:['tests/media-client/*.test.ts'],fileParallelism:false}});
