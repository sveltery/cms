import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: ['tests/plugin-runtime/canonical-cron-source.test.ts'],
  globals: true, environment: 'node', fileParallelism: false
} });
