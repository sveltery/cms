import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ resolve: { alias: {
  'seed-datetime-subject': fileURLToPath(new URL('./src/lib/server/database/lifecycle/upstream/database/content-datetime.ts', import.meta.url))
} }, test: { environment: 'node', fileParallelism: false,
  include: ['tests/source-seed-backend/datetime.test.ts'] } });
