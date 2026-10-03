import {defineConfig} from 'vitest/config';
import {resolve,dirname} from 'node:path';
const root=import.meta.dirname;
const frozen=resolve(root,'parity/emdash/blocks/source-tests');
export default defineConfig({plugins:[{
  name:'immutable-blocks-native-host',enforce:'pre',
  resolveId(specifier,importer) {
    if(specifier==='#node-sqlite'&&importer?.startsWith(frozen))return resolve(root,'src/lib/server/database/node-sqlite-compat.ts');
    if(specifier==='cloudflare:test'&&importer?.startsWith(frozen))return resolve(root,'tests/helpers/blocks-source-worker-env.ts');
    if(!importer?.startsWith(frozen)||!specifier.startsWith('.'))return;
    const target=resolve(dirname(importer),specifier);
    if(target.includes('/packages/core/tests/utils/test-db.js'))return resolve(root,'tests/helpers/blocks-source-database.ts');
    if(target.includes('/packages/core/tests/utils/mcp-runtime.js'))return resolve(root,'tests/helpers/blocks-source-runtime.ts');
    if(target.endsWith('/packages/core/src/request-cache.js'))return resolve(root,'src/lib/server/blocks/request-cache.ts');
    if(target.endsWith('/packages/core/src/request-context.js'))return resolve(root,'src/lib/server/taxonomies/upstream/request-context.ts');
    if(target.endsWith('/packages/core/src/database/instrumentation.js'))return resolve(root,'src/lib/server/taxonomies/upstream/database/instrumentation.ts');
    if(target.includes('/packages/core/src/schema/block-type-registry.js'))return resolve(root,'src/lib/server/blocks/registry.ts');
    if(target.includes('/packages/core/src/schema/block-type-contract.js'))return resolve(root,'src/lib/server/blocks/contract.ts');
    if(target.includes('/packages/core/src/schema/block-types.js'))return resolve(root,'src/lib/server/schema/block-types.ts');
    if(target.includes('/packages/core/src/schema/registry.js'))return resolve(root,'tests/helpers/blocks-source-schema.ts');
    if(target.includes('/packages/core/src/database/repositories/content.js'))return resolve(root,'tests/helpers/blocks-source-content.ts');
    if(target.includes('/packages/core/src/api/errors.js'))return resolve(root,'src/lib/server/blocks/errors.ts');
    if(target.includes('/packages/core/src/api/handlers/content.js'))return resolve(root,'tests/helpers/blocks-source-content-handlers.ts');
    if(target.includes('/packages/core/src/media/local-runtime.js'))return resolve(root,'src/lib/server/media/source/media/local-runtime.ts');
    if(target.includes('/packages/core/src/database/migrations/083_block_types.js'))return resolve(root,'src/lib/server/blocks/source-migration.ts');
    if(target.includes('/packages/core/src/database/migrations/runner.js'))return resolve(root,'tests/helpers/blocks-source-worker-migrations.ts');
    if(target.includes('/packages/cloudflare/src/db/d1-dialect.js'))return resolve(root,'tests/helpers/blocks-source-worker-dialect.ts');
    if(target.endsWith('/d1-schema.js'))return target.slice(0,-3)+'.ts';
    if(target.includes('/packages/core/src/seed/apply.js'))return resolve(root,'tests/helpers/blocks-source-seed.ts');
    if(target.includes('/packages/core/src/cli/commands/export-seed.js'))return resolve(root,'tests/helpers/blocks-source-seed.ts');
    if(target.includes('/packages/core/src/i18n/config.js'))return resolve(root,'src/lib/server/taxonomies/upstream/i18n/config.ts');
    if(target.includes('/packages/core/src/components/blocks.js'))return resolve(root,'src/lib/blocks/render.ts');
    if(target.endsWith('/packages/admin/src/lib/url'))return resolve(root,'parity/emdash/blocks/source-fixtures/packages/admin/src/lib/url.ts');
    if(target.endsWith('/packages/admin/src/lib/datetime-local'))return resolve(root,'src/lib/blocks/datetime-local.ts');
    if(target.includes('/packages/admin/src/lib/block-field-state.js'))return resolve(root,'src/lib/blocks/state.ts');
  },
  transform(code,id){if(id.startsWith(frozen)&&id.endsWith('.ts'))return {code:code.replaceAll('_emdash_','_cms_'),map:null};}
}],test:{globals:true,fileParallelism:false,maxWorkers:1,include:[
  'parity/emdash/blocks/source-tests/packages/core/tests/unit/schema/block-type-contract.test.ts',
  'parity/emdash/blocks/source-tests/packages/core/tests/unit/{request-context,metrics}.test.ts',
  'parity/emdash/blocks/source-tests/packages/core/tests/integration/schema/{block-type-registry,blocks-field-schema}.test.ts',
  'parity/emdash/blocks/source-tests/packages/core/tests/integration/content/{blocks-content,media-field-validation,image-dark-variant-normalize,repeater-media-normalize}.test.ts',
  'parity/emdash/blocks/source-tests/packages/core/tests/unit/components/blocks-renderer.test.ts',
  'parity/emdash/blocks/source-tests/packages/core/tests/integration/database/block-types-migration.test.ts',
  'parity/emdash/blocks/source-tests/packages/core/tests/unit/seed/blocks.test.ts',
  'parity/emdash/blocks/source-tests/packages/core/tests/workerd/{block-type-registry-d1,blocks-content-d1,blocks-seed-d1}.test.ts',
  'parity/emdash/blocks/source-tests/packages/admin/tests/lib/{block-field-state,datetime-local,url}.test.ts'
]}});
