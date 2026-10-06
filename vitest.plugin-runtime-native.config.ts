import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: ['tests/plugin-runtime/**/*.test.ts'], environment: 'node', fileParallelism: false
} });
