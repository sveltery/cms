import {defineConfig} from 'vitest/config';
import {dirname,resolve,relative} from 'node:path';
import {existsSync} from 'node:fs';
import taxonomy from './vitest.taxonomy-core-source.config.mts';

const root=import.meta.dirname;
const wholeTests=resolve(root,'parity/emdash/query-sdk-source/upstream/packages/core');
const publishedFixture=resolve(root,'parity/emdash/taxonomies/source/packages/core');
const sourceExtension=resolve(root,'parity/emdash/query-sdk-source/reference/packages/core');
const coreRoots=[wholeTests,publishedFixture,sourceExtension];
const boundaries: Record<string,string>={
  'src/loader.ts':'src/lib/server/query-sdk/loader.ts',
  'src/query.ts':'src/lib/server/query.ts',
  'src/request-context.ts':'src/lib/server/menus/context.ts',
  'src/request-cache.ts':'src/lib/server/menus/request-cache.ts',
  'src/object-cache/index.ts':'src/lib/server/menus/object-cache.ts'
};
function sourceFile(logical:string) {
  const boundary=boundaries[logical];
  if(boundary)return resolve(root,boundary);
  if(logical==='src/schema/registry.ts'||logical==='src/database/migrations/runner.ts')return resolve(root,'tests/helpers/query-sdk/source-read-fixture.ts');
  const published=resolve(publishedFixture,logical);
  return existsSync(published)?published:resolve(sourceExtension,logical);
}
export default defineConfig({
 ...taxonomy,
 plugins:[{
  name:'genuine-source-physical-query-read-fixture',enforce:'pre',
  resolveId(id,importer) {
   if(id==='#node-sqlite')return sourceFile('src/db/node-sqlite-compat.ts');
   if(!importer||!id.startsWith('.'))return;
   const core=coreRoots.find(core=>importer.startsWith(core+'/'));
   if(!core)return;
   const target=resolve(dirname(importer),id.replace(/\.js$/,'.ts'));
   const logical=relative(core,target).replaceAll('\\','/');
   if(!logical.startsWith('../'))return sourceFile(logical);
  }
 },...taxonomy.plugins!],
 test:{environment:'node',fileParallelism:false,include:[
  'parity/emdash/query-sdk-source/upstream/packages/core/tests/integration/loader-cursor-plan.test.ts',
  'parity/emdash/query-sdk-source/upstream/packages/core/tests/integration/loader-fold-plan.test.ts',
  'parity/emdash/query-sdk-source/upstream/packages/core/tests/integration/loader-taxonomy-pivot-plan.test.ts'
 ]}
});
