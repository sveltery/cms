import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'node:path';
const root = import.meta.dirname;
const frozen = resolve(root, 'parity/emdash/full-search-source/upstream/packages/core');
const routes: Record<string, string> = {
  'src/schema/registry.ts': 'tests/helpers/full-search/source-host.ts',
  'tests/utils/test-db.ts': 'tests/helpers/full-search/source-host.ts',
  'src/database/repositories/content.ts': 'src/lib/server/database/lifecycle/upstream/database/repositories/content.ts',
  'src/database/repositories/types.ts': 'src/lib/server/database/lifecycle/upstream/database/repositories/types.ts',
  'src/search/fts-manager.ts': 'src/lib/server/content-picker/fts-manager.ts',
  'src/search/match.ts': 'src/lib/server/database/lifecycle/upstream/search/match.ts',
  'src/search/query.ts': 'src/lib/server/search/query.ts',
  'src/search/types.ts': 'src/lib/server/content-picker/types.ts',
  'src/i18n/config.ts': 'src/lib/server/menus/i18n-config.ts',
  'src/api/schemas/search.ts': 'src/lib/server/search/schemas.ts'
};
export default defineConfig({ plugins: [{ name: 'whole-search-native-storage-transport', enforce: 'pre',
  resolveId(id, importer) {
    if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
    const target = resolve(dirname(importer), id).replace(/\.js$/, '.ts');
    for (const [source, native] of Object.entries(routes)) {
      if (target === resolve(frozen, source)) return resolve(root, native);
    }
  }
}], test: { fileParallelism: false, include: [
  'parity/emdash/full-search-source/upstream/packages/core/tests/unit/search/*.test.ts',
  'parity/emdash/full-search-source/upstream/packages/core/tests/unit/api/search-schema.test.ts',
  'parity/emdash/full-search-source/upstream/packages/core/tests/integration/search/*.test.ts',
  'tests/search-native/*.test.ts'
] } });
