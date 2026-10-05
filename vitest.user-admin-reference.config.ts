import {defineConfig} from 'vitest/config';
import {resolve,dirname} from 'node:path';
const root=import.meta.dirname,fixtures=resolve(root,'parity/emdash/user-admin-reference/runtime');
export default defineConfig({plugins:[{name:'qualified-whole-public-user-authority',enforce:'pre',resolveId(id,importer){
 if((id==='#api/schemas.js'||id==='#api/schemas.mjs'))return resolve(fixtures,'packages/core/src/api/schemas/users.mjs');
 if(id.startsWith('#api/'))return resolve(fixtures,'packages/core/src/api/'+id.slice(5).replace(/\.(?:js|ts)$/,'.mjs'));
 if(id.startsWith('#db/'))return resolve(fixtures,'packages/core/src/database/'+id.slice(4).replace(/\.(?:js|ts)$/,'.mjs'));
 if(id==='@emdash-cms/auth')return resolve(fixtures,'packages/auth/src/types.mjs');
 if(id==='@emdash-cms/auth/adapters/kysely')return resolve(fixtures,'packages/auth/src/adapters/kysely.mjs');
 if(importer?.endsWith('tests/accounts-source-contract/public-users.test.mjs')&&id==='../helpers/accounts-source-db.mjs')return resolve(root,'tests/helpers/user-admin-reference-db.mjs');
 if(importer?.endsWith('tests/accounts-source-contract/public-users.test.mjs')&&id.startsWith('../fixtures/accounts/'))return resolve(fixtures,id.slice('../fixtures/accounts/'.length));
 if(!importer?.startsWith(fixtures)||!id.startsWith('.'))return;
 return resolve(dirname(importer),id).replace(/\.(?:js|ts)$/,'.mjs');
}}],test:{environment:'node',fileParallelism:false,include:['parity/emdash/user-admin-reference/runtime/tests/accounts-source-contract/public-users.test.mjs']}});
