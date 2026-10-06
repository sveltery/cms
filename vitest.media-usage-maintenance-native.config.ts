import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', fileParallelism: false,
  include: ['tests/media-usage-maintenance-native/work.test.ts',
    'tests/media-usage-maintenance-native/reconciliation.test.ts',
    'tests/media-usage-maintenance-native/deletion.test.ts'] } });
