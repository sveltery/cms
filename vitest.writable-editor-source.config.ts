import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const errors = fileURLToPath(new URL('./src/lib/editor/errors.ts', import.meta.url));
export default defineConfig({ plugins: [{ name: 'native-editor-validation-host', enforce: 'pre',
  resolveId(id, importer) {
    if (importer?.endsWith('/packages/admin/tests/lib/content-validation-errors.test.ts') &&
      (id === '../../src/lib/api/client' || id === '../../src/lib/content-validation-errors')) return errors;
  },
  transform(code, id) {
    if (id === errors) return { code: `${code}\nexport { EditorResponseError as ApiResponseError };`, map: null };
  }
}], test: { environment: 'node', include: ['parity/emdash/writable-editor-source/packages/admin/tests/lib/content-validation-errors.test.ts'] } });
