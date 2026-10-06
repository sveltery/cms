import {defineConfig} from 'vitest/config';
import {resolve} from 'node:path';
const root=import.meta.dirname;
export default defineConfig({plugins:[{name:'whole-user-request-validator-authority',enforce:'pre',resolveId(id,importer){
 if(importer?.endsWith('packages/core/tests/unit/api/parse-envelope.test.ts')&&id==='../../../src/api/parse.js')return resolve(root,'src/lib/server/sections-widgets/api/parse.ts');
}}],test:{environment:'node',fileParallelism:false,include:['parity/emdash/user-admin-inputs/source/packages/core/tests/unit/api/parse-envelope.test.ts']}});
