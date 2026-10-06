import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', fileParallelism: false,
  include: ['tests/entry-locks-native/*.test.{ts,mjs}'] } });
