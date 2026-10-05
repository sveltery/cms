import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const root = import.meta.dirname;
const source = resolve(root, 'parity/emdash/calendar-locales-source/upstream/packages/admin');
const family = resolve(source, 'tests/lib/locales.test.ts');

export default defineConfig({
  plugins: [{
    name: 'whole-calendar-locales-native-module',
    enforce: 'pre',
    resolveId(specifier, importer) {
      if (importer !== family || !specifier.startsWith('.')) return;
      if (resolve(dirname(importer), specifier) === resolve(source, 'src/locales/index.js')) {
        return resolve(root, 'src/lib/ui/locales/index.ts');
      }
    }
  }],
  test: {
    include: ['parity/emdash/calendar-locales-source/upstream/packages/admin/tests/lib/locales.test.ts'],
    environment: 'node',
    fileParallelism: false
  }
});
