import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const frozenRoot = path.join(root, 'tests/redirect-source/upstream/packages/core');
const nativeRoot = path.join(root, 'src/lib/server/redirects');
export default defineConfig({
  plugins: [{
    name: 'whole-redirect-source-native-boundaries',
    enforce: 'pre',
    resolveId(id, importer) {
      if (!importer?.startsWith(frozenRoot)) return;
      if (id === '#api/redirect.js') return path.join(root, 'src/lib/server/auth/safe-redirect.ts');
      if (!id.startsWith('.')) return;
      const target = path.resolve(path.dirname(importer), id);
      if (target.startsWith(path.join(frozenRoot, 'src/redirects/'))) {
        return path.join(nativeRoot, path.basename(target).replace(/\.js$/, '.ts'));
      }
      if (target === path.join(frozenRoot, 'src/deferred-tasks.js')) return path.join(nativeRoot, 'deferred-tasks.ts');
      if (target === path.join(frozenRoot, 'src/api/schemas/redirects.js')) return path.join(nativeRoot, 'schemas.ts');
    }
  }],
  test: {
    environment: 'node',
    include: ['tests/redirect-source/upstream/packages/core/tests/unit/redirects/*.test.ts',
      'tests/redirect-source/upstream/packages/core/tests/unit/schemas/redirects.test.ts',
      'tests/redirect-source/upstream/packages/core/tests/unit/api/redirect.test.ts'],
    fileParallelism: false
  }
});
