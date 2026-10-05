import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'node:path';

const root = import.meta.dirname;
const frozen = resolve(root, 'parity/emdash/query-sdk-source/upstream/packages/core');
const routes: Record<string, string> = {
  'src/query.ts': 'src/lib/server/query.ts',
  'src/loader.ts': 'src/lib/server/query-sdk/loader.ts',
  'src/request-context.ts': 'src/lib/server/menus/context.ts',
  'src/request-cache.ts': 'src/lib/server/menus/request-cache.ts',
  'src/object-cache/index.ts': 'src/lib/server/menus/object-cache.ts',
  'src/i18n/config.ts': 'src/lib/server/menus/i18n-config.ts',
  'src/database/repositories/content.ts': 'src/lib/server/database/lifecycle/upstream/database/repositories/content.ts',
  'src/database/repositories/types.ts': 'src/lib/server/database/lifecycle/upstream/database/repositories/types.ts',
  'src/schema/registry.ts': 'tests/helpers/query-sdk/source-host.ts',
  'tests/utils/test-db.ts': 'tests/helpers/query-sdk/source-host.ts',
  'src/api/index.ts': 'tests/helpers/query-sdk/source-host.ts',
  'src/api/handlers/content.ts': 'tests/helpers/query-sdk/source-host.ts',
  'src/database/repositories/relation.ts': 'src/lib/server/relations/repository.ts',
  'src/database/repositories/byline.ts': 'src/lib/server/bylines/repository.ts',
  'src/database/repositories/taxonomy.ts': 'src/lib/server/taxonomies/repository.ts',
  'src/database/repositories/revision.ts': 'src/lib/server/database/lifecycle/upstream/database/repositories/revision.ts',
  'src/schema/byline-registry.ts': 'src/lib/server/bylines/registry.ts',
  'src/taxonomies/index.ts': 'src/lib/server/taxonomies/index.ts',
  'src/bylines/index.ts': 'src/lib/server/bylines/index.ts',
  'src/bylines/field-defs-cache.ts': 'src/lib/server/bylines/field-defs-cache.ts'
};

export default defineConfig({
  plugins: [{
    name: 'whole-query-sdk-native-import-transport',
    enforce: 'pre',
    resolveId(id, importer) {
      if (id === 'astro:content') return resolve(root, 'src/lib/server/query-sdk/live-provider.ts');
      if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
      const target = resolve(dirname(importer), id).replace(/\.js$/, '.ts');
      for (const [source, native] of Object.entries(routes)) {
        if (target === resolve(frozen, source)) return resolve(root, native);
      }
    }
  }],
  test: {
    fileParallelism: false,
    include: ['parity/emdash/query-sdk-source/upstream/packages/core/tests/**/*.test.ts'],
    exclude: [
      'parity/emdash/query-sdk-source/upstream/packages/core/tests/integration/content/reference-public-query.test.ts',
      'parity/emdash/query-sdk-source/upstream/packages/core/tests/integration/content/reference-query-caching.test.ts',
      'parity/emdash/query-sdk-source/upstream/packages/core/tests/unit/query-fallback-locale.test.ts'
    ]
  }
});
