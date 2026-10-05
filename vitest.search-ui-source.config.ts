import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
const root = import.meta.dirname;
const frozen = resolve(root, 'parity/emdash/full-search-source/upstream/packages/core');
const routes: Record<string, string> = {
 'src/components/live-search-routing.ts': 'src/lib/search/live-search-routing.ts',
 'src/components/webmcp-search.ts': 'src/lib/search/webmcp-search.ts'
};
export default defineConfig({ plugins: [{ name: 'whole-search-ui-native-imports', enforce: 'pre',
 resolveId(id, importer) {
  if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
  const target = resolve(dirname(importer), id).replace(/\.js$/, '.ts');
  for (const [source, native] of Object.entries(routes)) {
   if (target === resolve(frozen, source)) return resolve(root, native);
  }
 }
}], test: { fileParallelism: false, include: [
 'parity/emdash/full-search-source/upstream/packages/core/tests/unit/components/live-search-routing.test.ts',
 'parity/emdash/full-search-source/upstream/packages/core/tests/unit/components/webmcp-search.test.ts'
] } });
