import {defineConfig} from 'vitest/config';
import {resolve,dirname} from 'node:path';

const root=process.cwd();
const testSource=resolve(root,'tests/source-taxonomy-history/packages/core/src');
const fixtureSource=resolve(root,'tests/fixtures/taxonomy-history/packages/core/src');
// Preserve the pinned core Vitest host defaults. No scheduler/provider is run.
const virtualStubs:Record<string,string>={
  'virtual:emdash/wait-until':'export const waitUntil = undefined;',
  'virtual:emdash/scheduler':'export const createScheduler = null;',
  'virtual:emdash/config':'export default {};',
  'virtual:emdash/env':'export const env = undefined;',
  'virtual:emdash/build':'export const buildTime = 0;'
};

export default defineConfig({plugins:[{
  name:'pinned-taxonomy-history-fixtures',enforce:'pre',
  resolveId(id,importer){
    if(Object.hasOwn(virtualStubs,id))return '\0'+id;
    if(id==='@emdash-cms/admin/slugify')return resolve(root,'tests/fixtures/taxonomy-history/packages/admin/src/slugify.ts');
    if(!importer||!id.startsWith('.'))return;
    const target=resolve(dirname(importer),id);
    if(target.includes('/tests/source-taxonomy-history/packages/core/tests/utils/test-db')) {
      return resolve(root,'tests/helpers/taxonomy-history-db.ts');
    }
    if(target.startsWith(testSource+'/')) {
      return resolve(fixtureSource,target.slice(testSource.length+1).replace(/\.js$/,'.ts'));
    }
    if(importer.startsWith(fixtureSource+'/')&&target.endsWith('.js')) {
      return target.replace(/\.js$/,'.ts');
    }
  },
  load(id){if(id.startsWith('\0virtual:emdash/'))return virtualStubs[id.slice(1)];}
}],test:{
  include:['tests/source-taxonomy-history/packages/core/tests/integration/database/*.test.ts'],
  fileParallelism:false,maxWorkers:1
}});
