import {defineConfig} from 'vitest/config';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {playwright} from '@vitest/browser-playwright';
import {resolve,dirname} from 'node:path';
const root=import.meta.dirname, frozen=resolve(root,'parity/emdash/media/source-tests/packages/admin');
export default defineConfig({plugins:[svelte({configFile:false}),{name:'immutable-media-canvas-host',enforce:'pre',resolveId(specifier,importer){
 if(!importer?.startsWith(frozen)||!specifier.startsWith('.'))return;
 const target=resolve(dirname(importer),specifier);
 if(target===resolve(frozen,'src/components/MediaImageCropper.js'))return resolve(root,'tests/helpers/media-cropper-react-bridge.ts');
 if(target===resolve(frozen,'tests/utils/render.tsx'))return resolve(root,'tests/helpers/media-cropper-browser-render.ts');
 if(target===resolve(frozen,'src/media-image-cropper.css'))return resolve(root,'src/lib/media/source/media-cropper.css');
 if(target===resolve(frozen,'src/lib/crop-image.js'))return resolve(root,'src/lib/media/source/crop-image.ts');
}}],oxc:{jsx:{runtime:'automatic'}},test:{fileParallelism:false,include:['parity/emdash/media/source-tests/packages/admin/tests/lib/crop-image.test.ts','parity/emdash/media/source-tests/packages/admin/tests/components/MediaImageCropper.test.tsx'],
 browser:{enabled:true,headless:true,provider:playwright({launchOptions:{chromiumSandbox:true,timeout:30000}}),instances:[{browser:'chromium'}]}}});
