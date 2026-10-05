import { defineConfig } from 'vitest/config';
// This command intentionally remains failed; it preserves the original Native
// standalone handoff expectation and earns no green or Source callback credit.
export default defineConfig({test: {
  fileParallelism: false,
  include: ['tests/query-sdk-native/standalone-handoff.test.ts']
}});
