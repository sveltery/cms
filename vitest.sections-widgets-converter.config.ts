import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
const root = fileURLToPath(new URL('.', import.meta.url));
const frozen = resolve(root, 'parity/emdash/sections-widgets-source/upstream/packages/gutenberg-to-portable-text');
export default defineConfig({
  plugins: [{ name: 'whole-converter-native-import-boundary', enforce: 'pre', resolveId(id, importer) {
    if (!importer?.startsWith(`${frozen}/tests/`) || !id.startsWith('../src/')) return;
    const target = resolve(dirname(importer), id);
    for (const name of ['index', 'inline', 'types']) if (target === `${frozen}/src/${name}.js`) return `${root}src/lib/server/sections-widgets/gutenberg/${name}.ts`;
  } }],
  test: { environment: 'node', include: ['parity/emdash/sections-widgets-source/upstream/packages/gutenberg-to-portable-text/tests/*.test.ts'] }
});
