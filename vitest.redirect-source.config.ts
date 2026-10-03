import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const frozenRoot = path.join(root, 'parity/emdash/redirect-source/upstream/packages/core');
const nativeRoot = path.join(root, 'src/lib/server/redirects');
export default defineConfig({
  plugins: [{
    name: 'whole-redirect-source-native-boundaries',
    enforce: 'pre',
    resolveId(id, importer) {
      if (!importer?.startsWith(frozenRoot)) return;
      if (id === '#node-sqlite') return path.join(root, 'src/lib/server/database/node-sqlite-compat.ts');
      if (id === '#api/redirect.js') return path.join(root, 'src/lib/server/auth/safe-redirect.ts');
      if (!id.startsWith('.')) return;
      const target = path.resolve(path.dirname(importer), id);
      if (target.startsWith(path.join(frozenRoot, 'src/redirects/'))) {
        return path.join(nativeRoot, path.basename(target).replace(/\.js$/, '.ts'));
      }
      if (target === path.join(frozenRoot, 'src/deferred-tasks.js')) return path.join(nativeRoot, 'deferred-tasks.ts');
      if (target === path.join(frozenRoot, 'src/db/node-sqlite-compat.js')) return path.join(root, 'src/lib/server/database/node-sqlite-compat.ts');
      if (target === path.join(frozenRoot, 'src/database/migrations/runner.js')) return path.join(root, 'tests/helpers/redirects/migration-runner.ts');
      if (target === path.join(frozenRoot, 'tests/utils/test-db.js')) return path.join(root, 'tests/helpers/redirects/test-db.ts');
      if (target === path.join(frozenRoot, 'src/database/repositories/redirect.js')) return path.join(nativeRoot, 'repository.ts');
      if (target.endsWith('/src/database/migrations/081_redirect_write_guards.js') && importer.includes('/unit/database/migrations/')) return path.join(root, 'tests/helpers/redirects/migration-namespace.ts');
      if (target.startsWith(path.join(frozenRoot, 'src/database/migrations/')) && !target.endsWith('/runner.js')) return path.join(nativeRoot, 'migrations', path.basename(target).replace(/\.js$/, '.ts'));
      if (target === path.join(frozenRoot, 'src/api/schemas/redirects.js')) return path.join(nativeRoot, 'schemas.ts');
    }
  }],
  test: {
    environment: 'node',
    include: ['parity/emdash/redirect-source/upstream/packages/core/tests/unit/redirects/*.test.ts',
      'parity/emdash/redirect-source/upstream/packages/core/tests/unit/schemas/redirects.test.ts',
      'parity/emdash/redirect-source/upstream/packages/core/tests/unit/api/redirect.test.ts',
      'parity/emdash/redirect-source/upstream/packages/core/tests/integration/redirects/redirect-repository.test.ts',
      'parity/emdash/redirect-source/upstream/packages/core/tests/unit/database/migrations/081_redirect_write_guards.test.ts',
      'parity/emdash/redirect-source/upstream/packages/core/tests/integration/redirects/redirect-artifacts.test.ts',
      'parity/emdash/redirect-source/upstream/packages/core/tests/integration/redirects/redirect-pattern-precedence.test.ts',
      'parity/emdash/redirect-source/upstream/packages/core/tests/integration/redirects/log404-bounded.test.ts'],
    fileParallelism: false
  }
});
