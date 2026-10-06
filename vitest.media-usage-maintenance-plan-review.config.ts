import { defineConfig } from 'vitest/config';
export default defineConfig({test:{environment:'node',fileParallelism:false,
  include:['tests/media-usage-maintenance-native/deletion-plan-review.test.ts']}});
