import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'node:path';
const root = import.meta.dirname;
const frozen = resolve(root, 'parity/emdash/setup-api-source/upstream/packages/core');
const host = resolve(root, 'tests/helpers/setup-api/welcome-source-http.ts');
export default defineConfig({
  plugins: [{
    name: 'whole-setup-welcome-source-real-kit-http', enforce: 'pre',
    resolveId(id, importer) {
      if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
      const target = resolve(dirname(importer), id).replace(/\.js$/, '.ts');
      if (['src/astro/routes/api/auth/me.ts', 'src/database/repositories/user.ts', 'tests/utils/test-db.ts']
        .some(path => target === resolve(frozen, path))) return host;
    }
  }],
  test: {
    fileParallelism: false,
    include: ['parity/emdash/setup-api-source/upstream/packages/core/tests/unit/auth/me-welcome-dismiss.test.ts']
  }
});
