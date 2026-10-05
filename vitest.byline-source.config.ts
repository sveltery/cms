import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const source = path.join(root, 'parity/emdash/byline-source/upstream/packages/core');
const native = path.join(root, 'src/lib/server/bylines');
const helpers = path.join(root, 'tests/helpers/bylines');
export default defineConfig({
  plugins: [{ name: 'whole-byline-test-native-import-host', enforce: 'pre', resolveId(id, importer) {
    if (id === '#node-sqlite') return path.join(root, 'src/lib/server/database/node-sqlite-compat.ts');
    if (!importer?.startsWith(source) || !id.startsWith('.')) return;
    const target = path.resolve(path.dirname(importer), id).replaceAll(path.sep, '/');
    const key = path.relative(source, target).replaceAll(path.sep, '/');
    const imports: Record<string, string> = {
      'src/database/repositories/byline.js': path.join(native, 'repository.ts'),
      'src/schema/byline-registry.js': path.join(native, 'schema.ts'),
      'src/bylines/index.js': path.join(native, 'index.ts'),
      'src/bylines/credits.js': path.join(native, 'credits.ts'),
      'src/bylines/field-defs-cache.js': path.join(native, 'field-defs-cache.ts'),
      'src/api/handlers/bylines.js': path.join(native, 'handlers.ts'),
      'src/api/handlers/byline-fields.js': path.join(native, 'field-handlers.ts'),
      'tests/utils/test-db.js': path.join(helpers, 'reference-db.ts'),
      'src/database/migrations/runner.js': path.join(helpers, 'reference-db.ts'),
      'src/loader.js': path.join(root, 'src/lib/server/menus/loader.ts'),
      'src/i18n/config.js': path.join(root, 'src/lib/server/menus/i18n-config.ts'),
      'src/request-context.js': path.join(root, 'src/lib/server/menus/context.ts'),
      'src/request-cache.js': path.join(root, 'src/lib/server/menus/request-cache.ts'),
      'src/object-cache/index.js': path.join(root, 'src/lib/server/menus/object-cache.ts')
    };
    return imports[key];
  }}],
  test: { environment: 'node', fileParallelism: false, include: [
    'parity/emdash/byline-source/upstream/packages/core/tests/unit/database/repositories/byline.test.ts',
    'parity/emdash/byline-source/upstream/packages/core/tests/unit/schema/byline-registry.test.ts',
    'parity/emdash/byline-source/upstream/packages/core/tests/unit/bylines/bylines-query.test.ts',
    'parity/emdash/byline-source/upstream/packages/core/tests/unit/api/handlers/bylines.test.ts'
  ] }
});
