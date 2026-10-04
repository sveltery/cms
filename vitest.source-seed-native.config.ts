import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', fileParallelism: false,
  include: ['tests/source-seed-backend-native.test.ts'], testTimeout: 30000 } });
