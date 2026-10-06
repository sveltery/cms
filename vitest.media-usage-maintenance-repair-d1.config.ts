import { defineConfig } from 'vitest/config';
export default defineConfig({test:{environment:'node',fileParallelism:false,maxWorkers:1,
  include:['tests/media-usage-maintenance-native/repair-d1.test.ts']}});
