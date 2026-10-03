import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const frozen = path.join(root, 'parity/emdash/menu-source/upstream/packages/core');
const native = path.join(root, 'src/lib/server/menus');
const helpers = path.join(root, 'tests/helpers/menus');
export default defineConfig({
  plugins: [{
    name: 'whole-menu-tests-native-storage-boundaries', enforce: 'pre',
    resolveId(id, importer) {
      if (!importer?.startsWith(frozen)) return;
      if (id === '#node-sqlite') return path.join(root, 'src/lib/server/database/node-sqlite-compat.ts');
      if (id === 'kysely') return path.join(helpers, 'source-kysely.ts');
      if (!id.startsWith('.')) return;
      const target = path.resolve(path.dirname(importer), id);
      const relative = path.relative(frozen, target).replaceAll(path.sep, '/');
      const map: Record<string, string> = {
        'src/database/repositories/menu.js': path.join(native, 'repository.ts'),
        'src/api/handlers/menus.js': path.join(native, 'handlers.ts'),
        'src/api/schemas/menus.js': path.join(native, 'schemas.ts'),
        'src/menus/index.js': path.join(native, 'index.ts'),
        'src/i18n/config.js': path.join(native, 'i18n-config.ts'),
        'src/i18n/resolve.js': path.join(native, 'i18n-resolve.ts'),
        'src/utils/url.js': path.join(native, 'url.ts'),
        'src/database/connection.js': path.join(helpers, 'test-db.ts'),
        'src/database/migrations/runner.js': path.join(helpers, 'test-db.ts'),
        'src/schema/registry.js': path.join(helpers, 'schema.ts'),
        'tests/utils/test-db.js': path.join(helpers, 'test-db.ts'),
        'src/loader.js': path.join(native, 'loader.ts'),
        'src/object-cache/index.js': path.join(native, 'object-cache.ts'),
        'src/object-cache/codec.js': path.join(native, 'object-cache-codec.ts'),
        'src/object-cache/memory.js': path.join(native, 'object-cache-memory.ts'),
        'src/request-context.js': path.join(native, 'context.ts'),
        'src/astro/prefetch.js': path.join(native, 'prefetch.ts'),
        'src/astro/routes/api/menus/[name]/items/[id].js': path.join(root, 'src/routes/api/menus/[name]/items/[id]/+server.ts')
      };
      return map[relative];
    }
  }],
  test: {
    environment: 'node', fileParallelism: false,
    include: [
      'parity/emdash/menu-source/upstream/packages/core/tests/unit/menus/*.test.ts',
      'parity/emdash/menu-source/upstream/packages/core/tests/integration/database/menu-repository.test.ts',
      'parity/emdash/menu-source/upstream/packages/core/tests/integration/api/menus-handlers.test.ts',
      'parity/emdash/menu-source/upstream/packages/core/tests/unit/object-cache.test.ts'
    ]
  }
});
