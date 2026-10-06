import { defineConfig } from 'vitest/config';
import handlers from './vitest.relations-handlers-source.config.ts';

// The same byte-exact original repository family runs on the actual canonical
// migrations and trusted CmsDatabase owner, exercising its atomic path. The
// reference host remains a separate run, including actual Source migration SQL.
export default defineConfig({
  ...handlers,
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['parity/emdash/relations-source/executable/packages/core/tests/integration/database/relation-repository.test.ts']
  }
});
