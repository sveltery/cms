import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    include: [
      'parity/emdash/seo-storage/source/packages/core/tests/unit/database/repositories/seo.test.ts',
      'parity/emdash/seo-storage/source/packages/core/tests/unit/loader-seo.test.ts',
      'parity/emdash/seo-storage/source/packages/core/tests/integration/seo/*.test.ts'
    ]
  }
});
