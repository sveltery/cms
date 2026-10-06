import { defineConfig } from 'vitest/config';

// First test-first prerequisite receipt. No replacement EmDashRuntime is supplied.
export default defineConfig({ test: { environment: 'node', fileParallelism: false, include: [
  'parity/emdash/default-seed-setup-runtime/source/packages/core/tests/integration/runtime/*.test.ts',
  'parity/emdash/default-seed-setup-runtime/source/packages/core/tests/integration/astro/*.test.ts'
] } });
