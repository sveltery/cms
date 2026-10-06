import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', fileParallelism: false,
  include: ['tests/source-seed-backend/original-d1-fixture-control.test.ts'] } });
