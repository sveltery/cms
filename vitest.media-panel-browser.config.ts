import {defineConfig} from 'vitest/config';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {playwright} from '@vitest/browser-playwright';
import {resolve,dirname} from 'node:path';
const root=import.meta.dirname,frozen=resolve(root,'parity/emdash/media-panel/source-tests/packages/admin');
export default defineConfig({
 plugins:[svelte({configFile:false}),{name:'immutable-media-panel-native-host',enforce:'pre',resolveId(specifier,importer){
  if(!importer)return;
  if(importer===resolve(root,'src/lib/media/MediaCropDialog.svelte')&&specifier==='./MediaImageCropper.svelte')return resolve(root,'tests/helpers/MediaPanelCropperMock.svelte');
  if(specifier==='$app/paths')return resolve(root,'tests/helpers/media-panel-client-paths.ts');
  if(importer.startsWith(resolve(root,'src/lib/media/'))&&specifier==='./client')return resolve(root,'tests/helpers/media-panel-client-host.ts');
  if(!importer.startsWith(frozen)&&!importer.startsWith(resolve(root,'tests/helpers/')))return;
  if(!specifier.startsWith('.'))return;
  const target=resolve(dirname(importer),specifier).replace(/\.(js|tsx?)$/,'');
  if(target===resolve(frozen,'src/components/MediaDetailPanel'))return resolve(root,'tests/helpers/media-panel-react-bridge.ts');
  if([resolve(frozen,'src/lib/api'),resolve(frozen,'src/lib/api/index')].includes(target))return resolve(root,'tests/helpers/media-panel-api-host.ts');
  if(target===resolve(frozen,'src/lib/crop-image'))return resolve(root,'src/lib/media/source/crop-image.ts');
  if(target===resolve(frozen,'src/components/MediaImageCropper'))return resolve(root,'tests/helpers/media-panel-cropper-reference.ts');
  if(target===resolve(frozen,'src/components/MediaUsedIn'))return resolve(root,'tests/helpers/media-panel-used-in-unimplemented.ts');
  if(target===resolve(frozen,'tests/utils/render'))return resolve(root,'tests/helpers/media-panel-browser-render.ts');
  if(target===resolve(frozen,'src/media-image-cropper.css'))return resolve(root,'src/lib/media/source/media-cropper.css');
 }}],
 resolve:{dedupe:['react','react-dom']},
 // The first secured baseline discovered this renderer dependency mid-test and reloaded its runner.
 optimizeDeps:{include:['react-dom/client']},
 oxc:{jsx:{runtime:'automatic'}},
 test:{fileParallelism:false,include:[
  'parity/emdash/media-panel/source-tests/packages/admin/tests/components/MediaDetailPanel.test.tsx',
  'parity/emdash/media-panel/source-tests/packages/admin/tests/components/MediaDetailPanelNavigation.test.tsx',
  'tests/media-panel-host/native-row-preservation.browser.tsx',
 ],browser:{enabled:true,headless:true,viewport:{width:1280,height:800},provider:playwright({contextOptions:{timezoneId:'America/New_York'},launchOptions:{chromiumSandbox:true,timeout:30000}}),instances:[{browser:'chromium'}]}}
});
