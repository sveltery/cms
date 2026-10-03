import {defineConfig} from 'vitest/config';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {playwright} from '@vitest/browser-playwright';
import {resolve,dirname} from 'node:path';
const root=import.meta.dirname,frozen=resolve(root,'parity/emdash/redirect-integration-source/upstream/packages/admin');
export default defineConfig({plugins:[svelte({configFile:false}),{
 name:'whole-immutable-redirect-admin-native-mount',enforce:'pre',
 resolveId(specifier,importer){if(!importer?.startsWith(frozen)||!specifier.startsWith('.'))return;
  const target=resolve(dirname(importer),specifier).replace(/\.(tsx?|js)$/,'');
  if(target===resolve(frozen,'src/components/Redirects'))return resolve(root,'tests/helpers/redirect-integration-source-react.tsx');
  if(target===resolve(frozen,'src/lib/api/redirects'))return resolve(root,'src/lib/redirects/client.ts');
  if(target===resolve(frozen,'tests/utils/render'))return resolve(root,'tests/helpers/bulk-taxonomy-render.ts');
 }
}],resolve:{conditions:['browser']},oxc:{jsx:{runtime:'automatic'}},test:{fileParallelism:false,
 include:['parity/emdash/redirect-integration-source/upstream/packages/admin/tests/components/Redirects.test.tsx'],
 setupFiles:['parity/emdash/bulk-taxonomy/source/packages/admin/tests/setup.ts'],
 browser:{enabled:true,headless:true,provider:playwright({launchOptions:{chromiumSandbox:true,timeout:30000}}),instances:[{browser:'chromium'}],viewport:{width:1280,height:800}}
}});
