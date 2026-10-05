import { defineConfig } from 'vitest/config';
import { dirname, resolve, relative } from 'node:path';
import { existsSync } from 'node:fs';
import taxonomy from './vitest.taxonomy-core-source.config.mts';
const root = import.meta.dirname;
const seo = resolve(root, 'parity/emdash/seo-storage/source');
const source = resolve(root, 'parity/emdash/taxonomies/source');
const referenceApi = resolve(root, 'tests/helpers/seo/reference-api.mjs');
const referenceRead = resolve(root, 'tests/helpers/seo/reference-read.mjs');
const nativeSitemapResponse = resolve(root, 'src/lib/server/seo/sitemap-response.ts');
const nativeHreflang = resolve(root, 'src/lib/server/seo/hreflang.ts');
const nativeBoundaries: Record<string, string> = {
  'packages/core/src/database/repositories/seo.ts': referenceApi,
  'packages/core/src/seo/hreflang.ts': referenceApi,
  'packages/core/src/astro/routes/sitemap-[collection].xml.ts': resolve(root, 'tests/helpers/seo/reference-sitemap-route.mjs'),
  'packages/core/src/api/handlers/seo.ts': referenceApi,
  'packages/core/src/i18n/config.ts': resolve(root, 'src/lib/server/menus/i18n-config.ts'),
  'packages/core/src/i18n/resolve.ts': resolve(root, 'src/lib/server/menus/i18n-resolve.ts')
};
export default defineConfig({
  plugins: [{ name: 'seo-distinct-source-physical-reference', enforce: 'pre', resolveId(id, importer) {
    if ((importer === nativeHreflang || importer === nativeSitemapResponse) && id === './read.ts') return referenceRead;
    if (importer === nativeHreflang && id === '../database/lifecycle/upstream/database/repositories/content.ts') {
      return resolve(source, 'packages/core/src/database/repositories/content.ts');
    }
    if (importer?.startsWith(seo) && id.startsWith('.')) {
      const logical = relative(seo, resolve(dirname(importer), id.replace(/\.js$/, '.ts'))).replaceAll('\\', '/');
      if (logical in nativeBoundaries) return nativeBoundaries[logical];
      const original = resolve(source, logical);
      if (existsSync(original)) return original;
      const retained = resolve(seo, logical);
      if (existsSync(retained)) return retained;
    }
  }}, ...(taxonomy.plugins ?? [])],
  test: { environment: 'node', fileParallelism: false, include: [
    'parity/emdash/seo-storage/source/packages/core/tests/unit/database/repositories/seo.test.ts',
    'parity/emdash/seo-storage/source/packages/core/tests/integration/seo/hreflang.test.ts',
    'parity/emdash/seo-storage/source/packages/core/tests/integration/seo/sitemap-route.test.ts'
  ] }
});
