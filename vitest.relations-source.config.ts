import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const frozen = path.join(root, 'parity/emdash/relations-source/executable/packages/core');
export default defineConfig({
  plugins: [{ name: 'whole-original-relations-boundaries', enforce: 'pre', resolveId(id, importer) {
    if (!importer?.startsWith(frozen)) return;
    if (id === 'kysely' && importer.endsWith('relation-set-children-writes.test.ts')) return path.join(root, 'tests/helpers/relations/source-kysely.ts');
    if (!id.startsWith('.')) return;
    const relative = path.relative(frozen, path.resolve(path.dirname(importer), id)).replaceAll(path.sep, '/');
    const map: Record<string, string> = {
      'src/database/repositories/relation.js': 'src/lib/server/relations/repository.ts',
      'src/database/types.js': 'src/lib/server/database/lifecycle/upstream/database/types.ts',
      'src/database/migrations/runner.js': 'tests/helpers/relations/source-db.ts',
      'tests/utils/test-db.js': 'tests/helpers/relations/source-db.ts',
      'src/database/dialect-helpers.js': 'src/lib/server/database/lifecycle/upstream/database/dialect-helpers.ts',
      'src/db/node-sqlite-compat.js': 'src/lib/server/database/node-sqlite-compat.ts'
    };
    return map[relative] && path.join(root, map[relative]);
  }}],
  test: { environment: 'node', fileParallelism: false, include: ['parity/emdash/relations-source/executable/packages/core/tests/integration/database/relation-repository.test.ts', 'parity/emdash/relations-source/executable/packages/core/tests/integration/database/relation-set-children-writes.test.ts', 'parity/emdash/relations-source/executable/packages/core/tests/integration/database/content-references.test.ts', 'parity/emdash/relations-source/executable/packages/core/tests/integration/database/relations-structural-migration.test.ts'] }
});
