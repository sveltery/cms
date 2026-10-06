import {defineConfig} from 'vitest/config';
import {resolve,dirname} from 'node:path';
const root=import.meta.dirname,source=resolve(root,'parity/emdash/media-admin-editor/source/packages/admin');
export default defineConfig({plugins:[{name:'whole-media-admin-source-imports',enforce:'pre',resolveId(id,importer){
 if(!importer?.startsWith(source)||!id.startsWith('.'))return;
 const path=resolve(dirname(importer),id).replace(/\.(tsx?|js)$/,'');
 if(path===resolve(source,'src/lib/api/media'))return resolve(root,'src/lib/media/source/api/media.ts');
 if(path===resolve(source,'src/lib/api/client'))return resolve(root,'src/lib/media/source/api/client.ts');
 if(path===resolve(source,'src/lib/api/media-usage-activation'))return resolve(root,'src/lib/media/source/api/media-usage-activation.ts');
 if(path===resolve(source,'src/lib/media-utils'))return resolve(root,'src/lib/media/source/media-utils.ts');
}}],test:{fileParallelism:false,include:['parity/emdash/media-admin-editor/source/packages/admin/tests/lib/media-{search,pagination,playback,file-url,usage-activation-api}.test.ts']}});
