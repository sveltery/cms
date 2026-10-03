import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const frozen = path.join(root, 'parity/emdash/sections-widgets-source/upstream/packages/core');
const native = path.join(root, 'src/lib/server/sections-widgets');
const testDb = path.join(root, 'tests/helpers/sections-widgets/test-db.ts');
export default defineConfig({
  plugins: [{ name: 'whole-sections-widgets-native-source-boundaries', enforce: 'pre', resolveId(id, importer) {
    if (id === 'virtual:emdash/object-cache') return path.join(root, 'tests/helpers/sections-widgets/virtual-cache.ts');
    if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
    const target = path.resolve(path.dirname(importer), id);
    const relative = path.relative(frozen, target);
    if (relative === 'tests/utils/test-db.js' || relative === 'src/database/connection.js' || relative === 'src/database/migrations/runner.js') return testDb;
    if (relative === 'src/loader.js') return path.join(native, 'context.ts');
    if (relative === 'src/request-context.js') return path.join(native, 'request-context.ts');
    if (relative === 'src/astro/prefetch.js') return path.join(native, 'prefetch.ts');
    if (relative === 'src/import/sections.js') return path.join(native, 'sections/import.ts');
    if (relative.startsWith('src/widgets/')) return path.join(native, relative.slice(4).replace(/\.js$/, '.ts'));
  } }],
  test: { environment: 'node', fileParallelism: false,
    include: ['parity/emdash/sections-widgets-source/upstream/packages/core/tests/unit/widgets/*.test.ts',
      'parity/emdash/sections-widgets-source/upstream/packages/core/tests/unit/import/sections.test.ts'] }
});
