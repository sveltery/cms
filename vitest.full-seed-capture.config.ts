import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const frozen = path.join(root, 'parity/emdash/full-seed-engine/source/packages/core');
const modules: Record<string, string> = {
  'tests/utils/test-db.js': 'tests/helpers/full-seed/source-db.ts',
  'src/schema/registry.js': 'tests/helpers/full-seed/capture-registry.ts',
  'src/media/usage/activation.js': 'src/lib/server/seed/upstream/media/usage/activation.ts',
  'src/media/usage/capture-triggers.js': 'src/lib/server/seed/upstream/media/usage/capture-triggers.ts',
  'src/media/usage/content-refresh.js': 'src/lib/server/seed/upstream/media/usage/content-refresh.ts',
  'src/media/usage/content-fields.js': 'src/lib/server/seed/upstream/media/usage/content-fields.ts',
  'src/media/usage/content-snapshots.js': 'src/lib/server/seed/upstream/media/usage/content-snapshots.ts',
  'src/media/usage/source-key.js': 'src/lib/server/blocks/upstream/media/usage/source-key.ts',
  'src/database/repositories/media-usage.js': 'src/lib/server/blocks/upstream/database/repositories/media-usage.ts',
  'src/database/repositories/revision.js': 'src/lib/server/seed/upstream/database/repositories/revision.ts',
  'src/database/validate.js': 'src/lib/server/database/lifecycle/upstream/database/validate.ts',
  'src/schema/block-type-registry.js': 'src/lib/server/blocks/upstream/schema/block-type-registry.ts',
  'src/api/media-usage-write-fence.js': 'src/lib/server/seed/upstream/api/media-usage-write-fence.ts',
  'src/database/migrations/063_media_usage_incremental_work.js': 'src/lib/server/seed/upstream/database/migrations/063_media_usage_incremental_work.ts'
};
export default defineConfig({
  plugins: [{ name: 'whole-original-seed-capture', enforce: 'pre', resolveId(id, importer) {
    if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
    const relative = path.relative(frozen, path.resolve(path.dirname(importer), id)).replaceAll(path.sep, '/');
    return modules[relative] && path.join(root, modules[relative]);
  } }],
  test: { environment: 'node', fileParallelism: false, include: [
    'parity/emdash/full-seed-engine/source/packages/core/tests/integration/database/media-usage-activation.test.ts',
    'parity/emdash/full-seed-engine/source/packages/core/tests/integration/database/media-usage-capture-trigger.test.ts',
    'parity/emdash/full-seed-engine/source/packages/core/tests/integration/database/media-usage-content-refresh.test.ts',
    'parity/emdash/full-seed-engine/source/packages/core/tests/integration/database/media-usage-content-fields.test.ts',
    'parity/emdash/full-seed-engine/source/packages/core/tests/integration/database/media-usage-content-snapshots.test.ts'
  ] }
});
