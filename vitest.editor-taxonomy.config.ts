import {defineConfig} from 'vitest/config';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {playwright} from '@vitest/browser-playwright';
import {resolve,dirname} from 'node:path';
const root=import.meta.dirname,frozen=resolve(root,'parity/emdash/editor-taxonomies/source/packages/admin');
export default defineConfig({plugins:[svelte({configFile:false,compilerOptions:{experimental:{async:true}}}),{name:'whole-taxonomy-native-before-feature-host',enforce:'pre',resolveId(specifier,importer){
 if(specifier==='editor-taxonomy-baseline-ui')return resolve(root,'parity/emdash/editor-taxonomies/native-baseline/src/lib/ui/TaxonomySidebar.svelte');
 if(specifier==='$lib/taxonomies.remote')return resolve(root,'tests/helpers/editor-taxonomy-remote-host.ts');
 if(specifier==='@cloudflare/kumo'&&importer?.startsWith(frozen))return resolve(root,'tests/helpers/editor-taxonomy-test-toasty.ts');
 if(!importer?.startsWith(frozen)||!specifier.startsWith('.'))return;
 const target=resolve(dirname(importer),specifier).replace(/\.(tsx?|js)$/,'');
 if(target===resolve(frozen,'src/components/TaxonomySidebar'))return resolve(root,'tests/helpers/editor-taxonomy-react-baseline.ts');
 if(target===resolve(frozen,'tests/utils/render'))return resolve(root,'tests/helpers/editor-taxonomy-browser-render.ts');
 if(target===resolve(frozen,'src/lib/api/client'))return resolve(root,'tests/helpers/editor-taxonomy-api-host.ts');
 }}],resolve:{alias:{$lib:resolve(root,'src/lib')}},oxc:{jsx:{runtime:'automatic'}},test:{fileParallelism:false,include:['parity/emdash/editor-taxonomies/source/packages/admin/tests/components/TaxonomySidebar.test.tsx'],browser:{enabled:true,provider:playwright({launchOptions:{chromiumSandbox:true,timeout:30000,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})}}),instances:[{browser:'chromium'}],viewport:{width:1280,height:800}}}});
