// Whole unchanged Source callbacks; finite Svelte/React import and mock transport only.
import {defineConfig} from 'vitest/config';
import {resolve,dirname} from 'node:path';
import parentConfig from './vitest.media-admin-editor-browser.config';
const root=import.meta.dirname,source=resolve(root,'parity/emdash/media-admin-editor/source/packages/admin');
export default defineConfig({...parentConfig,plugins:[{
 name:'complete-detail-native-widget-transport',enforce:'pre',resolveId(id,importer){
  if(importer?.split('?')[0]===resolve(root,'src/lib/media/MediaDetails.svelte')){
   if(id==='./MediaImageCropper.svelte')return resolve(root,'tests/helpers/MediaPanelCropperMock.svelte');
   if(id==='./MediaUsedIn.svelte')return resolve(root,'tests/helpers/MediaPanelUsedInMock.svelte');
  }
  if(importer?.split('?')[0]===resolve(root,'src/lib/media/MediaUsedIn.svelte')&&id==='./detail-api')return resolve(root,'tests/helpers/media-panel-api-host.ts');
  if(!importer?.startsWith(source)||!id.startsWith('.'))return;
  const target=resolve(dirname(importer.split('?')[0]!),id).replace(/\.(tsx?|js)$/,'');
  const named={'src/components/FocalPointEditor':'tests/helpers/media-panel-focal-react-bridge.ts','src/components/MediaUsedIn':'tests/helpers/media-panel-used-in-react-bridge.ts','src/components/useContainedMediaSize':'tests/helpers/media-panel-contained-react-bridge.ts','src/lib/api/index':'tests/helpers/media-panel-api-host.ts'};
  for(const[from,to]of Object.entries(named))if(target===resolve(source,from))return resolve(root,to);
 },
},...(parentConfig.plugins??[])],test:{...parentConfig.test,include:['MediaDetailPanel','MediaDetailPanelNavigation','FocalPointEditor','MediaUsedIn','MediaImageCropper','useContainedMediaSize'].map(name=>`parity/emdash/media-admin-editor/source/packages/admin/tests/components/${name}.test.tsx`)}});
