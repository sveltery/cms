import {defineConfig} from 'vitest/config';
import {resolve,dirname} from 'node:path';

const root=process.cwd();
const testSource=resolve(root,'tests/source-taxonomy-history/packages/core/src');
const fixtureSource=resolve(root,'tests/fixtures/taxonomy-history/packages/core/src');

export default defineConfig({plugins:[{
  name:'pinned-taxonomy-history-fixtures',enforce:'pre',
  resolveId(id,importer){
    if(!importer||!id.startsWith('.'))return;
    const target=resolve(dirname(importer),id);
    if(target.includes('/tests/source-taxonomy-history/packages/core/tests/utils/test-db')) {
      return resolve(root,'tests/helpers/taxonomy-history-db.ts');
    }
    if(target.startsWith(testSource+'/')) {
      return resolve(fixtureSource,target.slice(testSource.length+1).replace(/\.js$/,'.ts'));
    }
  }
}],test:{
  include:['tests/source-taxonomy-history/packages/core/tests/integration/database/*.test.ts'],
  fileParallelism:false,maxWorkers:1
}});
