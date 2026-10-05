import {defineConfig} from 'vitest/config';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {playwright} from '@vitest/browser-playwright';
import {resolve,dirname} from 'node:path';
const root=import.meta.dirname,source=resolve(root,'parity/emdash/media-admin-editor/source/packages/admin');
const groups={
 helpers:['lib/*.test.ts','pt-*-converters.test.ts'],
 library:['components/MediaLibrary*.test.tsx','components/MediaFolderDialog.test.tsx','components/MediaImportSummary.test.tsx','components/MediaUploadDialog.test.tsx','components/useMediaUploadQueue.test.tsx'],
 panel:['components/MediaDetailPanel*.test.tsx','components/FocalPointEditor.test.tsx','components/MediaUsedIn.test.tsx','components/MediaImageCropper.test.tsx','components/useContainedMediaSize.test.tsx'],
 picker:['components/MediaPicker*.test.tsx','media-picker-multiselect.test.tsx','components/BlockKitMediaPickerField.test.tsx','components/ImageFieldRenderer.test.tsx'],
 image:['editor-image-*.test.tsx','editor/image-*.test.{ts,tsx}','components/ImageDetailPanel.test.tsx','components/ImageDropTargets.test.tsx'],
 gallery:['gallery-detail-panel.test.tsx','components/GalleryFocalPoint.test.ts'],
 settings:['components/settings/MediaUsageSettings.test.tsx'],
};
const group=process.env.MEDIA_SOURCE_GROUP;
if(group&&!Object.hasOwn(groups,group))throw new Error(`Unknown whole Media Source group ${group}`);
const include=(group?groups[group as keyof typeof groups]:Object.values(groups).flat()).map(path=>`parity/emdash/media-admin-editor/source/packages/admin/tests/${path}`);
export default defineConfig({plugins:[{name:'whole-media-native-framework-transport',enforce:'pre',resolveId(id,importer){
 if(id==='$app/paths')return resolve(root,'tests/helpers/media-panel-client-paths.ts');
 if(importer===resolve(root,'src/lib/media/MediaDetails.svelte')&&id==='./client')return resolve(root,'tests/helpers/media-panel-client-host.ts');
 if(importer?.startsWith(resolve(root,'src/lib/media/'))&&id==='./detail-api')return resolve(root,'tests/helpers/media-panel-api-host.ts');
 if(importer===resolve(root,'tests/helpers/media-picker-react-bridge.ts')&&id==='./media-picker-api-host')return resolve(root,'tests/helpers/media-panel-api-host.ts');
 if(importer===resolve(root,'tests/helpers/MediaPickerReactDetail.svelte')&&id==='./media-picker-detail-react')return resolve(root,'tests/helpers/media-panel-react-bridge.ts');
 if(!importer?.startsWith(source)||!id.startsWith('.'))return;
 const target=resolve(dirname(importer.split('?')[0]!),id).replace(/\.(tsx?|js)$/,'');
 const named={
  'src/components/MediaLibrary':'tests/helpers/media-admin-editor-library-react.tsx',
  'src/components/MediaDetailPanel':'tests/helpers/media-panel-react-bridge.ts',
  'src/components/MediaPickerModal':'tests/helpers/media-picker-react-bridge.ts',
  'src/lib/api':'tests/helpers/media-panel-api-host.ts',
  'src/lib/api/media':'src/lib/media/source/api/media.ts',
  'src/lib/api/client':'src/lib/media/source/api/client.ts',
  'src/lib/api/current-user':'tests/helpers/media-picker-current-user.ts',
  'src/lib/api/media-usage-activation':'src/lib/media/source/api/media-usage-activation.ts',
  'src/lib/crop-image':'src/lib/media/source/crop-image.ts',
  'src/lib/media-utils':'src/lib/media/source/media-utils.ts',
  'src/components/MediaImageCropper':'tests/helpers/media-panel-cropper-reference.ts',
  'src/media-image-cropper.css':'src/lib/media/source/media-cropper.css',
 };
 for(const [from,to] of Object.entries(named))if(target===resolve(source,from))return resolve(root,to);
}},svelte({configFile:false})],resolve:{alias:{$lib:resolve(root,'src/lib')},dedupe:['react','react-dom']},
 optimizeDeps:{include:['react','react-dom/client','vitest-browser-react','@testing-library/react','@lingui/core','@lingui/react','@tanstack/react-query','@cloudflare/kumo']},
 oxc:{jsx:{runtime:'automatic'}},test:{fileParallelism:false,setupFiles:[resolve(source,'tests/setup.ts')],include,
 browser:{enabled:true,headless:true,viewport:{width:1280,height:800},provider:playwright({contextOptions:{timezoneId:'America/New_York'},launchOptions:{chromiumSandbox:true,timeout:30000}}),instances:[{browser:'chromium'}]}}
});
