import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ resolve: { alias: {
  'seed-namespace-subject': fileURLToPath(new URL('./tests/helpers/source-seed-backend/namespace-baseline.ts', import.meta.url))
} }, test: { environment: 'node', fileParallelism: false,
  include: ['tests/source-seed-backend/namespace.test.ts'] } });
