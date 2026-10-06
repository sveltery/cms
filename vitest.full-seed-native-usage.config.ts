import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'node',fileParallelism:false,include:['tests/source-seed-backend/usage-d1-native.test.ts']}});
