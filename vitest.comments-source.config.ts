import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const sourceRoot = path.join(root, 'tests/comments-source/packages/core');
const productRoot = path.join(root, 'src/lib/server/comments/upstream');

export default defineConfig({
  plugins: [{
    name: 'comments-whole-source-host',
    enforce: 'pre',
    resolveId(id, importer) {
      if (!importer) return;
      if (id.startsWith('#db/')) return path.join(productRoot, 'database', id.slice(4).replace(/\.js$/, '.ts'));
      if (!id.startsWith('.')) return;
      const target = path.resolve(path.dirname(importer), id);
      if (target.startsWith(path.join(sourceRoot, 'src/'))) {
        return path.join(productRoot, path.relative(path.join(sourceRoot, 'src'), target).replace(/\.js$/, '.ts'));
      }
      if (target === path.join(sourceRoot, 'tests/utils/test-db.js')) {
        return path.join(root, 'tests/helpers/comments/test-db.ts');
      }
      if (importer.startsWith(productRoot) && id.endsWith('.js')) return target.replace(/\.js$/, '.ts');
    }
  }],
  test: {
    include: ['tests/comments-source/packages/core/tests/unit/comments/*.test.ts',
      'tests/comments-source/packages/core/tests/integration/comments/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/helpers/comments/vite-host.ts'],
    fileParallelism: false
  }
});
