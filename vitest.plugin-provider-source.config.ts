import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const frozen = path.join(root, 'parity/emdash/plugin-runtime/source/packages/admin');
export default defineConfig({
  plugins: [{ name: 'whole-plugin-provider-tests-native-import-host', enforce: 'pre', resolveId(id, importer) {
    if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
    const relative = path.relative(frozen, path.resolve(path.dirname(importer), id)).replaceAll(path.sep, '/');
    if (relative === 'src/lib/plugin-context') return path.join(root, 'src/lib/plugins/page-path.ts');
    if (relative === 'src/lib/sandboxed-editor-extensions.js') return path.join(root, 'src/lib/plugins/editor-extensions.ts');
    if (relative === 'src/lib/content-editor-panels') return path.join(root, 'src/lib/plugins/content-editor-panels.ts');
    if (relative === 'src/lib/content-list-columns.js') return path.join(root, 'src/lib/plugins/content-list-columns.ts');
  } }],
  test: { include: [
    'parity/emdash/plugin-runtime/source/packages/admin/tests/lib/plugin-context.test.ts',
    'parity/emdash/plugin-runtime/source/packages/admin/tests/lib/sandboxed-editor-extensions.test.ts',
    'parity/emdash/plugin-runtime/source/packages/admin/tests/lib/content-editor-panels.test.tsx',
    'parity/emdash/plugin-runtime/source/packages/admin/tests/lib/content-list-columns.test.tsx'
  ], environment: 'node', fileParallelism: false }
});
