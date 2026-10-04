import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const frozen = path.join(root, 'parity/emdash/canonical-installation/source/packages/core');
export default defineConfig({
  plugins: [{ name: 'whole-canonical-installation-tests', enforce: 'pre',
    resolveId(id, importer) {
      if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
      const relative = path.relative(frozen, path.resolve(path.dirname(importer), id)).replaceAll(path.sep, '/');
      const map: Record<string, string> = {
        'src/database/repositories/taxonomy.js': path.join(root, 'src/lib/server/taxonomies/repository.ts'),
        'tests/utils/test-db.js': path.join(root, 'tests/helpers/canonical-installation/source-db.ts')
      };
      return map[relative];
    }
  }],
  test: { environment: 'node', fileParallelism: false,
    include: ['parity/emdash/canonical-installation/source/packages/core/tests/integration/database/taxonomy-repository-pagination.test.ts'] }
});
