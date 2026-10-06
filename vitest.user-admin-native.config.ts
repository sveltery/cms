import {defineConfig} from 'vitest/config';
import {resolve} from 'node:path';
export default defineConfig({resolve:{alias:{$lib:resolve(import.meta.dirname,'src/lib')}},test:{environment:'node',fileParallelism:false,
 include:['tests/user-admin-native/*.test.ts']}});
