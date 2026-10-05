import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const sourceRoot = local('./tests/schema-admin-completion/source/core/tests/unit/');
const contracts = local('./tests/schema-admin-completion/bridges/api-contracts.ts');
const registry = local('./tests/schema-admin-completion/bridges/registry.ts');
export default defineConfig({
  plugins: [{
    name: 'schema-source22-real-native-boundaries', enforce: 'pre',
    resolveId(source, importer) {
      if (!importer?.startsWith(sourceRoot)) return null;
      if (source === '../../../src/api/schemas/schema.js' || source === '../../../src/api/schemas/index.js') return contracts;
      if (source === '../../../src/schema/registry.js' || source === '../../../src/database/migrations/runner.js'
        || source === '../../../src/database/types.js') return registry;
      if (source === '#node-sqlite') return local('./src/lib/server/database/node-sqlite-compat.ts');
      return null;
    }
  }],
  test: { globals: true, environment: 'node', fileParallelism: false, include: [
    'tests/schema-admin-completion/source/core/tests/unit/api/collection-admin-schema.test.ts',
    'tests/schema-admin-completion/source/core/tests/unit/api/schema-update-collection-display-fields.test.ts',
    'tests/schema-admin-completion/source/core/tests/unit/schema/collection-title-date-fields.test.ts'
  ] }
});
