import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'node:path';
const checkout=import.meta.dirname;
const frozen=resolve(checkout,'parity/emdash/media/source-tests/packages/core');
const vendor=resolve(checkout,'src/lib/server/media/source');
export default defineConfig({ plugins:[{
  name:'immutable-media-source-host', enforce:'pre',
  resolveId(specifier,importer) {
    if (specifier==='@emdash-cms/auth') return resolve(vendor,'auth/index.ts');
    if (specifier==='#node-sqlite') return resolve(checkout,'src/lib/server/database/node-sqlite-compat.ts');
    if (!importer?.startsWith(frozen) || !specifier.startsWith('.')) return;
    const target=resolve(dirname(importer),specifier);
    if (target===resolve(frozen,'src/schema/registry.js')) return resolve(checkout,'tests/helpers/media-source-registry.ts');
    if (target===resolve(frozen,'tests/utils/image-fixtures.js')) return resolve(checkout,'parity/emdash/media/source-fixtures/image-fixtures.ts');
    if (target===resolve(frozen,'tests/utils/test-db.js')) return resolve(checkout,'tests/helpers/media-source-database.ts');
    if (target.startsWith(frozen+'/src/')) return resolve(vendor,target.slice((frozen+'/src/').length).replace(/\.js$/,'.ts'));
  },
  transform(code,id) { if(id.startsWith(frozen+'/tests/') && code.includes('_emdash_')) return {code:code.replaceAll('_emdash_','_cms_'),map:null}; }
}], test: {
  fileParallelism:false,
  include: [
    'parity/emdash/media/source-tests/packages/core/tests/integration/database/media-{filename-search,focal-point,folders,mime-filter,page-pagination,replace,upload-publish}.test.ts',
    'parity/emdash/media/source-tests/packages/core/tests/unit/database/repositories/media-confirm.test.ts',
    'parity/emdash/media/source-tests/packages/core/tests/unit/api/{media-list-route,media-focal-point,media-folders-handlers}.test.ts',
    'parity/emdash/media/source-tests/packages/core/tests/unit/api/handlers/media-upload.test.ts',
    'parity/emdash/media/source-tests/packages/core/tests/unit/api/media-folders-routes.test.ts',
    'parity/emdash/media/source-tests/packages/core/tests/integration/astro/media-{asset-route,confirm-placeholder,replace,upload-deduplication,upload-placeholder,upload-widening}.test.ts',
    'parity/emdash/media/source-tests/packages/core/tests/unit/media/{focal-point-normalize,media-value,mime,normalize,placeholder,responsive,thumbnail,url}.test.ts',
    'parity/emdash/media/source-tests/packages/core/tests/unit/storage/{local,s3}.test.ts'
  ]
}});
