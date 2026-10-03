import {defineConfig} from 'vitest/config';
import {resolve} from 'node:path';
export default defineConfig({resolve:{alias:{'$app/paths':resolve(import.meta.dirname,'tests/helpers/media-panel-client-paths.ts')}},test:{include:['tests/media-panel-host/*.test.ts'],fileParallelism:false}});
