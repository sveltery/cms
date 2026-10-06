import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';
import { existsSync } from 'node:fs';
import manifest from './parity/emdash/media-usage-maintenance-source/manifest.json' with { type: 'json' };
import { generateConfigModule, generateDialectModule } from './parity/emdash/taxonomies/source/packages/core/src/astro/integration/virtual-modules.ts';
import { sqlite } from './parity/emdash/taxonomies/source/packages/core/src/db/adapters.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const tests = resolve(root, 'parity/emdash/media-usage-maintenance-source/upstream/packages/core');
const upstream = resolve(root, 'parity/emdash/media-usage-maintenance-source/upstream');
const source = resolve(root, 'parity/emdash/media-usage-maintenance-source/reference');
const descriptor = sqlite({ url: ':memory:' });
const virtualModules = new Map([
  ['virtual:emdash/config', generateConfigModule({ databaseConfig: descriptor.config })],
  ['virtual:emdash/dialect', generateDialectModule({ entrypoint: descriptor.entrypoint, type: descriptor.type,
    supportsRequestScope: descriptor.supportsRequestScope ?? false,
    supportsCoalescing: descriptor.supportsCoalescing ?? false,
    supportsCollectionDeletionGuard: descriptor.supportsCollectionDeletionGuard ?? false })]
]);
const prefixes: Record<string, string> = {
  '#api/': 'api/', '#auth/': 'auth/', '#cache/': 'cache/', '#db/': 'database/',
  '#taxonomies/': 'taxonomies/', '#utils/': 'utils/', '#media/': 'media/'
};
export default defineConfig({
  plugins: [{ name: 'literal-source-reference-only-no-native-parity', enforce: 'pre',
    resolveId(id, importer) {
      if (virtualModules.has(id)) return '\0' + id;
      if (id === '@emdash-cms/auth') return resolve(root, 'tests/helpers/taxonomies/auth-reference.mjs');
      if (id === '@emdash-cms/admin/slugify') return resolve(root, 'src/lib/server/taxonomies/slugify.ts');
      if (id === '#node-sqlite') return resolve(source, 'packages/core/src/db/node-sqlite-compat.ts');
      if (id === 'emdash/db/sqlite') return resolve(source, 'packages/core/src/db/sqlite.ts');
      if (id === '#api/schemas.js') return resolve(source, 'packages/core/src/api/schemas/index.ts');
      for (const [prefix, directory] of Object.entries(prefixes)) {
        if (id.startsWith(prefix)) return resolve(source, 'packages/core/src', directory, id.slice(prefix.length).replace(/\.js$/, '.ts'));
      }
      if (importer?.startsWith(tests) && id.startsWith('.')) {
        const logical = relative(tests, resolve(dirname(importer), id)).replaceAll('\\', '/');
        if (logical === 'tests/utils/test-db.js') return resolve(source, 'packages/core/tests/utils/test-db.ts');
        if (logical.startsWith('src/')) return resolve(source, 'packages/core', logical.replace(/\.js$/, '.ts'));
      }
      if (importer?.startsWith(upstream) && id.startsWith('.')) {
        const logical = relative(upstream,resolve(dirname(importer),id)).replaceAll('\\','/');
        const target = resolve(source,logical.replace(/\.js$/,'.ts'));
        if (existsSync(target)) return target;
      }
      if (importer?.startsWith(source) && id.startsWith('.')) {
        const target = resolve(dirname(importer), id.replace(/\.js$/, '.ts'));
        if (existsSync(target)) return target;
      }
    },
    load(id) { if (id.startsWith('\0')) return virtualModules.get(id.slice(1)); }
  }],
  test: { environment: 'node', fileParallelism: false,
    include: manifest.records.filter(record => record.ownedWholeFamily).map(record => record.copiedPath)
  }
});
