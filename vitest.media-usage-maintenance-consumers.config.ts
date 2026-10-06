import { defineConfig } from 'vitest/config';
export default defineConfig({test:{environment:'node',fileParallelism:false,
  include:['tests/media-usage-maintenance-native/progress-operators.test.ts',
    'tests/media-usage-maintenance-native/processing.test.ts']}});
