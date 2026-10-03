import {defineConfig} from 'vitest/config';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {playwright} from '@vitest/browser-playwright';
import {resolve,dirname} from 'node:path';
const root=import.meta.dirname, frozen=resolve(root,'parity/emdash/blocks/source-tests');
export default defineConfig({
 plugins:[svelte({configFile:false}),{name:'immutable-blocks-browser-host',enforce:'pre',resolveId(specifier,importer){
  if(!importer?.startsWith(frozen)||!specifier.startsWith('.'))return;
  const target=resolve(dirname(importer),specifier);
  if(target.endsWith('/components/BlocksField.js')||target.endsWith('/components/BlockTypeList.js'))return resolve(root,'tests/helpers/blocks-react-bridge.ts');
  if(target.endsWith('/tests/utils/render.js'))return resolve(root,'tests/helpers/blocks-browser-render.ts');
 }}],
 resolve:{alias:{$lib:resolve(root,'src/lib')}},
 esbuild:{jsx:'automatic'},
 test:{include:['parity/emdash/blocks/source-tests/packages/admin/tests/components/{BlocksField,BlockTypeList}.test.tsx'],
  browser:{enabled:true,provider:playwright({launchOptions:{chromiumSandbox:true,timeout:30000}}),instances:[{browser:'chromium'}]}}
});
