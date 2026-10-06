import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ resolve: { alias: {
  'seed-namespace-subject': fileURLToPath(new URL('./src/lib/server/seed/namespace.ts', import.meta.url))
} }, test: { environment: 'node', fileParallelism: false,
  include: ['tests/source-seed-backend/namespace.test.ts', 'tests/source-seed-backend/namespace-metadata.test.ts', 'tests/source-seed-backend/namespace-catalog.test.ts', 'tests/source-seed-backend/namespace-plan.test.ts', 'tests/source-seed-backend/namespace-control.test.ts', 'tests/source-seed-backend/namespace-collision.test.ts', 'tests/source-seed-backend/namespace-predicate.test.ts', 'tests/source-seed-backend/namespace-compound.test.ts'] } });
