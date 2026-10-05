import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'node:path';

const root = import.meta.dirname;
const source = resolve(root, 'parity/emdash/taxonomies/source/packages/admin');
export default defineConfig({
  plugins: [{
    name: 'whole-taxonomy-match-native-module',
    enforce: 'pre',
    resolveId(specifier, importer) {
      if (!importer?.startsWith(source) || !specifier.startsWith('.')) return;
      const target = resolve(dirname(importer), specifier);
      if (target === resolve(source, 'src/lib/taxonomy-match.js')) {
        return resolve(root, 'src/lib/taxonomies/match.ts');
      }
    }
  }],
  test: {
    include: ['parity/emdash/taxonomies/source/packages/admin/tests/lib/taxonomy-match.test.ts'],
    environment: 'node',
    fileParallelism: false
  }
});
