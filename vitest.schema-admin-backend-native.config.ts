import { defineConfig } from 'vitest/config';
export default defineConfig({test:{environment:'node',fileParallelism:false,
  include:['tests/schema-admin-completion/native/collection-indexes.test.ts',
    'tests/schema-admin-completion/native/collection-index-forward.test.ts',
    'tests/schema-admin-completion/native/collection-index-operator-trigger.test.ts',
    'tests/schema-admin-completion/native/collection-index-atomic-adapters.test.ts']}});
