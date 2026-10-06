import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const frozen = path.join(root, 'parity/emdash/cron-storage-source/upstream/packages/core');
export default defineConfig({
  plugins: [{ name: 'whole-cron-storage-source-fixture', enforce: 'pre', resolveId(id, importer) {
    if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
    const target = path.resolve(path.dirname(importer), id);
    if (target === path.join(frozen, 'tests/utils/test-db.js')) return path.join(root, 'tests/helpers/cron-storage/source-db.ts');
  } }],
  test: { environment: 'node', globals: true, fileParallelism: false,
    include: ['parity/emdash/cron-storage-source/upstream/packages/core/tests/integration/database/cron-oneshot-utc-migration.test.ts'] }
});
