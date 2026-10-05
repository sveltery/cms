import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'node:path';
const root=import.meta.dirname;
const frozen=resolve(root,'parity/emdash/taxonomies/source/packages/core');
export default defineConfig({
  plugins:[{name:'original-source-ddl-node-fixture',enforce:'pre',resolveId(id,importer) {
    if(id==='#node-sqlite') return resolve(root,'src/lib/server/database/node-sqlite-compat.ts');
    if(!importer?.startsWith(frozen) || !id.startsWith('.') || !id.endsWith('.js')) return;
    return resolve(dirname(importer),id.replace(/\.js$/,'.ts'));
  }}],
  test:{environment:'node',fileParallelism:false,include:['tests/taxonomy-source-fixture/*.test.ts']}
});
