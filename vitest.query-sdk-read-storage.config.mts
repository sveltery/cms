import {defineConfig} from 'vitest/config';
import {dirname,resolve} from 'node:path';
import source from './vitest.query-sdk-plan-reference.config.mts';

const root=import.meta.dirname;
// Test-only explicit immutable534 baseline transport. No product test detection.
const baseline=process.env.SVELTERY_QUERY_READ_BASELINE;
export default defineConfig({
 ...source,
 plugins:[{
  name:'immutable-query-read-storage-testfirst',enforce:'pre',
  resolveId(id,importer) {
   if(!baseline||!importer||!id.startsWith('.'))return;
   if(importer.startsWith(baseline+'/')) {
    const target=resolve(root,'src/lib/server/query-sdk',id);
    if(target.endsWith('/read-storage.ts')||target.endsWith('/bindings.ts'))return resolve(baseline,target.split('/').at(-1)!);
    return target;
   }
   const target=resolve(dirname(importer),id);
   for(const file of ['read-storage.ts','bindings.ts'])if(target===resolve(root,'src/lib/server/query-sdk',file))return resolve(baseline,file);
  }
 },...source.plugins!],
 test:{...source.test,include:['tests/query-sdk-read-storage/*.test.mjs']}
});
