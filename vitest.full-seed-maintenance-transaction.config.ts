import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'node',fileParallelism:false,include:['tests/source-seed-backend/maintenance-transaction-observer-native.test.ts']}});
