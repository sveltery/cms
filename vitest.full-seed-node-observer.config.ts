import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'node',fileParallelism:false,include:['tests/source-seed-backend/node-provider-observer-native.test.ts']}});
