import {defineConfig} from 'vitest/config';
import {playwright} from '@vitest/browser-playwright';
import {resolve,dirname} from 'node:path';
const root=import.meta.dirname,frozen=resolve(root,'parity/emdash/media/source-tests/packages/admin');
export default defineConfig({plugins:[{name:'immutable-media-admin-api-host',enforce:'pre',resolveId(specifier,importer){
 if(!importer?.startsWith(frozen)||!specifier.startsWith('.'))return;
 const target=resolve(dirname(importer),specifier).replace(/\.(js|tsx?)$/,'');
 if(target===resolve(frozen,'src/lib/api/media'))return resolve(root,'src/lib/media/source/api/media.ts');
 if(target===resolve(frozen,'src/lib/api/client'))return resolve(root,'src/lib/media/source/api/client.ts');
 if(target===resolve(frozen,'src/lib/media-utils'))return resolve(root,'src/lib/media/source/media-utils.ts');
}}],test:{fileParallelism:false,include:['parity/emdash/media/source-tests/packages/admin/tests/lib/media-{upload,folders,search,pagination,playback,file-url,thumbnail}.test.ts'],browser:{enabled:true,headless:true,provider:playwright({launchOptions:{chromiumSandbox:true,timeout:30000}}),instances:[{browser:'chromium'}]}}});
