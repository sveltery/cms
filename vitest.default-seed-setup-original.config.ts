import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const frozen = path.join(root, 'parity/emdash/default-seed-setup-runtime/source/packages/core');
const modules: Record<string,string> = {
  'src/astro/routes/api/setup/index.js': 'tests/helpers/default-seed-setup/setup-context.ts',
  'src/database/repositories/options.js': 'src/lib/server/comments/upstream/database/repositories/options.ts',
  'tests/utils/test-db.js': 'tests/helpers/full-seed/source-db.ts'
};
// No replacement EmDashRuntime. Fresh-site/invalid consumers retain their
// prerequisite stops until their genuine full Original graph is qualified.
export default defineConfig({
  plugins: [{ name: 'whole-original-setup-context', enforce: 'pre', resolveId(id, importer) {
    if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
    const relative = path.relative(frozen, path.resolve(path.dirname(importer), id)).replaceAll(path.sep, '/');
    return modules[relative] && path.join(root, modules[relative]);
  } }],
  test: { environment: 'node', fileParallelism: false, include: [
    'parity/emdash/default-seed-setup-runtime/source/packages/core/tests/integration/runtime/*.test.ts',
    'parity/emdash/default-seed-setup-runtime/source/packages/core/tests/integration/astro/*.test.ts'
  ] }
});
