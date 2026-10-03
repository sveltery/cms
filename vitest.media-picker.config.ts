import {defineConfig} from 'vitest/config';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {playwright} from '@vitest/browser-playwright';
import {resolve,dirname} from 'node:path';
const root=import.meta.dirname,frozen=resolve(root,'parity/emdash/media-picker/source/packages/admin');
export default defineConfig({plugins:[svelte({configFile:false}),{name:'immutable-picker-test-host',enforce:'pre',resolveId(specifier,importer){
 if(!importer?.startsWith(frozen)||!specifier.startsWith('.'))return;
 const target=resolve(dirname(importer),specifier).replace(/\.(tsx?|js)$/,'');
 if(target===resolve(frozen,'src/components/MediaPickerModal'))return resolve(root,'tests/helpers/media-picker-react-bridge.ts');
 if(target===resolve(frozen,'tests/utils/render'))return resolve(root,'tests/helpers/media-picker-browser-render.ts');
 if(target===resolve(frozen,'src/lib/api')||target===resolve(frozen,'src/lib/api/media'))return resolve(root,'tests/helpers/media-picker-api-host.ts');
 if(target===resolve(frozen,'src/lib/api/current-user'))return resolve(root,'tests/helpers/media-picker-current-user.ts');
 if(target===resolve(frozen,'src/components/MediaDetailPanel'))return resolve(root,'tests/helpers/media-picker-detail-react.ts');
 }}],resolve:{alias:{$lib:resolve(root,'src/lib'),'$app/paths':resolve(root,'tests/helpers/media-picker-kit-paths.ts')}},oxc:{jsx:{runtime:'automatic'}},test:{fileParallelism:false,include:['tests/media-picker-native/picker-native.test.ts','parity/emdash/media-picker/source/packages/admin/tests/components/MediaPicker{Modal,Upload}.test.tsx','parity/emdash/media-picker/source/packages/admin/tests/media-picker-multiselect.test.tsx'],browser:{enabled:true,provider:playwright({launchOptions:{chromiumSandbox:true,timeout:30000}}),instances:[{browser:'chromium'}]}}});
