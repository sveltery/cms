import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', fileParallelism: false,
  include: ['parity/emdash/sections-widgets-source/upstream/packages/core/tests/unit/widgets/*.test.ts',
    'parity/emdash/sections-widgets-source/upstream/packages/core/tests/unit/import/sections.test.ts'] } });
