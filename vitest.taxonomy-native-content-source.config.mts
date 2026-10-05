import {defineConfig} from 'vitest/config';
import {dirname,resolve} from 'node:path';
const root=import.meta.dirname;
const source=resolve(root,'parity/emdash/taxonomies/source');
const fixture=resolve(root,'tests/helpers/taxonomies/native-content-fixture.mjs');
const original=resolve(source,'packages/core/tests/integration/content/content-taxonomies.test.ts');
export default defineConfig({plugins:[{name:'native-content-whole-source7',enforce:'pre',resolveId(id,importer){
 if(importer!==original||!id.startsWith('.'))return;
 const path=resolve(dirname(importer),id.replace(/\.js$/,'.ts'));
 if(path===resolve(source,'packages/core/tests/utils/test-db.ts')||path===resolve(source,'packages/core/src/api/handlers/content.ts'))return fixture;
 if(path===resolve(source,'packages/core/src/database/repositories/taxonomy.ts'))return resolve(root,'src/lib/server/taxonomies/repository.ts');
 if(path===resolve(source,'packages/core/src/i18n/config.ts'))return resolve(root,'src/lib/server/menus/i18n-config.ts');
}},],test:{environment:'node',fileParallelism:false,include:['parity/emdash/taxonomies/source/packages/core/tests/integration/content/content-taxonomies.test.ts']}});
