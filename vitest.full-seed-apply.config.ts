import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const frozen = path.join(root, 'parity/emdash/source-seed-backend/source/packages/core');
const modules: Record<string, string> = {
  'src/seed/apply.js': 'src/lib/server/seed/apply.ts',
  'src/seed/types.js': 'src/lib/server/seed/types.ts',
  'src/database/repositories/byline.js': 'src/lib/server/seed/upstream/database/repositories/byline.ts',
  'src/database/repositories/content.js': 'src/lib/server/seed/upstream/database/repositories/content.ts',
  'src/database/repositories/options.js': 'src/lib/server/comments/upstream/database/repositories/options.ts',
  'src/database/repositories/redirect.js': 'src/lib/server/redirects/repository.ts',
  'src/database/repositories/relation.js': 'src/lib/server/seed/upstream/database/repositories/relation.ts',
  'src/database/repositories/taxonomy-def.js': 'src/lib/server/taxonomies/definitions.ts',
  'src/database/repositories/taxonomy.js': 'src/lib/server/taxonomies/repository.ts',
  'src/database/types.js': 'src/lib/server/seed/upstream/database/types.ts',
  'src/object-cache/index.js': 'src/lib/server/menus/object-cache.ts',
  'src/deferred-tasks.js': 'src/lib/server/redirects/deferred-tasks.ts',
  'src/schema/registry.js': 'tests/helpers/full-seed/source-registry.ts',
  'tests/utils/test-db.js': 'tests/helpers/full-seed/source-db.ts'
};
export default defineConfig({
  plugins: [{ name: 'whole-original-seed-apply', enforce: 'pre', resolveId(id, importer) {
    if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
    const relative = path.relative(frozen, path.resolve(path.dirname(importer), id)).replaceAll(path.sep, '/');
    return modules[relative] && path.join(root, modules[relative]);
  } }],
  test: { environment: 'node', fileParallelism: false, include: [
    'parity/emdash/source-seed-backend/source/packages/core/tests/unit/seed/apply.test.ts',
    'parity/emdash/source-seed-backend/source/packages/core/tests/unit/seed/apply-budget.test.ts',
    'parity/emdash/source-seed-backend/source/packages/core/tests/unit/seed/apply-object-cache.test.ts'
  ] }
});
