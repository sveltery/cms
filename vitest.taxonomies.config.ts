import {defineConfig} from 'vitest/config';
import {resolve,dirname} from 'node:path';
import {readFileSync} from 'node:fs';
const root=process.cwd(),sourceRoot=resolve(root,'tests/source-taxonomies/packages/core/src'),runtime=resolve(root,'src/lib/server/taxonomies/upstream');
export default defineConfig({plugins:[{
 name:'pinned-taxonomy-native-fixtures',enforce:'pre',
 resolveId(id,importer){
  if(id==='#node-sqlite')return resolve(root,'src/lib/server/database/node-sqlite-compat.ts');
  if(id==='@emdash-cms/auth')return resolve(root,'tests/helpers/taxonomy-auth.ts');
  if(!importer||!id.startsWith('.'))return;
  const target=resolve(dirname(importer),id);
  if(target.includes('/tests/source-taxonomies/packages/core/tests/utils/test-db'))return resolve(root,'tests/helpers/taxonomy-source-db.ts');
  if(target.includes('/tests/source-taxonomies/packages/core/tests/utils/mcp-runtime'))return resolve(root,'tests/helpers/taxonomy-source-tools.ts');
  if(target.startsWith(sourceRoot+'/')){let suffix=target.slice(sourceRoot.length+1).replace(/\.js$/,'.ts');
   if(suffix==='database/migrations/runner.ts')return resolve(root,'tests/helpers/taxonomy-source-db.ts');
   if(suffix.startsWith('astro/routes/api/'))return resolve(root,'tests/helpers/taxonomy-source-routes.ts')+'?route='+encodeURIComponent(suffix);
   if(suffix==='astro/prefetch.ts')return resolve(root,'tests/helpers/taxonomy-source-prefetch.ts');
   return resolve(runtime,suffix);
  }
 },
 transform(code,id){if(id.includes('/tests/source-taxonomies/')&&id.endsWith('.test.ts'))return {code:code.replaceAll('_emdash_','_cms_'),map:null};},
 load(id){if(id.includes('taxonomy-source-routes.ts?route='))return readFileSync(resolve(root,'tests/helpers/taxonomy-source-routes.ts'),'utf8').replace('__NATIVE_SOURCE_ROUTE__',decodeURIComponent(id.split('?route=')[1]));}
}],test:{include:['tests/source-taxonomies/packages/core/tests/unit/taxonomies/*.test.ts','tests/source-taxonomies/packages/core/tests/integration/taxonomies/*.test.ts','tests/source-taxonomies/packages/core/tests/integration/taxonomy-*.test.ts','tests/source-taxonomies/packages/core/tests/integration/database/taxonomy-repository-pagination.test.ts'],fileParallelism:false,maxWorkers:1}});
