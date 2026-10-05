import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'node',fileParallelism:false,
 include:['tests/user-admin-native/*.test.ts']}});
