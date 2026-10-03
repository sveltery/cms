import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import base from './vitest.redirect-source.config.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const frozenRoot = path.join(root, 'parity/emdash/redirect-source/upstream/packages/core');

export default defineConfig({
  ...base,
  plugins: [{ name: 'whole-redirect-artifacts-real-D1-fixture', enforce: 'pre',
    resolveId(id, importer) {
      if (importer?.startsWith(frozenRoot) && id.startsWith('.') &&
        path.resolve(path.dirname(importer), id) === path.join(frozenRoot, 'tests/utils/test-db.js')) {
        return path.join(root, 'tests/helpers/redirects/test-db-d1.ts');
      }
    }
  }, ...(base.plugins ?? [])],
  test: { ...base.test, include: [
    'parity/emdash/redirect-source/upstream/packages/core/tests/integration/redirects/redirect-artifacts.test.ts'
  ] }
});
