import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const frozen = path.join(root, 'parity/emdash/source-seed-backend/source/packages/core');
export default defineConfig({
  plugins: [{ name: 'whole-source-seed-backend-families', enforce: 'pre', resolveId(id, importer) {
    if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
    const relative = path.relative(frozen, path.resolve(path.dirname(importer), id)).replaceAll(path.sep, '/');
    const map: Record<string, string> = {
      'src/seed/validate.js': path.join(root, 'src/lib/server/seed/validate.ts'),
      'src/seed/ownership.js': path.join(root, 'src/lib/server/seed/ownership.ts'),
      'src/schema/registry.js': path.join(root, 'src/lib/server/seed/fingerprint.ts'),
      'tests/utils/test-db.js': path.join(root, 'tests/helpers/source-seed-backend/source-db.ts')
    };
    return map[relative];
  } }],
  test: { environment: 'node', fileParallelism: false, include: [
    'parity/emdash/source-seed-backend/source/packages/core/tests/unit/seed/validate.test.ts',
    'parity/emdash/source-seed-backend/source/packages/core/tests/unit/seed/ownership.test.ts',
    'parity/emdash/source-seed-backend/source/packages/core/tests/unit/schema/seed-fingerprint.test.ts'
  ] }
});
