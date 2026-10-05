import { defineConfig } from 'vitest/config';
export default defineConfig({test:{environment:'node',fileParallelism:false,
  include:['tests/schema-admin-completion/native/collection-index-atomic-adapters.test.ts']}});
