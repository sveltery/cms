import { defineConfig } from 'vitest/config';
export default defineConfig({test: {
  fileParallelism: false,
  include: ['tests/query-sdk-native/*.test.ts'],
  // Retained genuine red for the explicitly documented standalone-read limit.
  // Coherent render consumers are exercised by the production-boundary tests.
  exclude: ['tests/query-sdk-native/standalone-handoff.test.ts']
}});
