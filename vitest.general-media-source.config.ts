import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const source = path.join(root, 'parity/emdash/general-media-source/upstream/packages/core');
const native = path.join(root, 'src/lib/server/general-media/upstream');
export default defineConfig({
  plugins: [{ name: 'whole-original-media-native-host', enforce: 'pre', resolveId(id, importer) {
    if (!importer?.startsWith(source) || !id.startsWith('.')) return;
    const relative = path.relative(source, path.resolve(path.dirname(importer), id)).replaceAll(path.sep, '/');
    if (relative === 'tests/utils/test-db.js') return path.join(root, 'tests/helpers/general-media/reference-db.ts');
    if (relative === 'tests/utils/image-fixtures.js') return path.join(source,'tests/utils/image-fixtures.ts');
    if (relative.startsWith('src/')) return path.join(native, relative.slice(4).replace(/\.js$/, '.ts'));
  }}],
  test: { environment: 'node', fileParallelism: false, include: [
    'parity/emdash/general-media-source/upstream/packages/core/tests/unit/storage/local.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/unit/media/enrich.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/unit/media/focal-point-normalize.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/unit/media/image-endpoint.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/unit/media/image-size-security.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/unit/media/media-allowlist.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/unit/media/media-value.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/unit/media/mime.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/unit/media/normalize.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/unit/media/placeholder.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/unit/media/responsive.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/unit/media/thumbnail.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/unit/media/url.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/unit/database/repositories/media-confirm.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/integration/database/media-filename-search.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/integration/database/media-focal-point.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/integration/database/media-folders.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/integration/database/media-mime-filter.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/integration/database/media-page-pagination.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/integration/database/media-replace.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/integration/database/media-upload-publish.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/unit/api/handlers/media-upload.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/unit/api/media-folders-handlers.test.ts',
    'parity/emdash/general-media-source/upstream/packages/core/tests/unit/api/media-focal-point.test.ts'
  ] }
});
