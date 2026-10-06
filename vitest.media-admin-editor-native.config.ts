import {defineConfig} from 'vitest/config';
import {resolve} from 'node:path';
const root=import.meta.dirname;
export default defineConfig({resolve:{alias:{$lib:resolve(root,'src/lib'),'$app/paths':resolve(root,'tests/helpers/media-panel-client-paths.ts')}},test:{environment:'node',fileParallelism:false,include:['tests/media-admin-editor/*.test.ts']}});
