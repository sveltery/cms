import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'node:path';
const root = import.meta.dirname;
const frozen = resolve(root, 'parity/emdash/content-picker-source/upstream/packages/core');
export default defineConfig({ plugins: [{ name: 'whole-content-picker-core-native-transport', enforce: 'pre',
  resolveId(id, importer) {
    if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
    const target = resolve(dirname(importer), id).replace(/\.js$/, '.ts');
    if (['src/api/handlers/content.ts', 'src/schema/registry.ts', 'tests/utils/test-db.ts'].some(path => target === resolve(frozen, path))) return resolve(root, 'tests/helpers/content-picker/source-host.ts');
    if (target === resolve(frozen, 'src/search/fts-manager.ts')) return resolve(root, 'src/lib/server/content-picker/fts-manager.ts');
  }
}], test: { fileParallelism: false, include: ['parity/emdash/content-picker-source/upstream/packages/core/tests/integration/content/*.test.ts', 'tests/content-picker-native.test.ts'] } });
