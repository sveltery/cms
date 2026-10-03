import {defineConfig} from 'vitest/config';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {playwright} from '@vitest/browser-playwright';
import {transformAsync} from '@babel/core';
import {resolve,dirname} from 'node:path';
const root=import.meta.dirname,frozen=resolve(root,'parity/emdash/bulk-taxonomy/source/packages/admin');
export default defineConfig({plugins:[svelte({configFile:false}),{
 name:'immutable-bulk-taxonomy-native-host',enforce:'pre',
 async transform(code,id){if(id.startsWith(frozen)&&/\.[jt]sx?$/.test(id)){const result=await transformAsync(code,{filename:id,configFile:false,babelrc:false,plugins:[['@lingui/babel-plugin-lingui-macro',{stripMessageField:false}]],parserOpts:{plugins:['typescript','jsx']}});return result?.code?{code:result.code,map:result.map}:null;}},
 resolveId(specifier,importer){if(!importer?.startsWith(frozen)||!specifier.startsWith('.'))return;
  const target=resolve(dirname(importer),specifier).replace(/\.(tsx?|js)$/,'');
  if(target===resolve(frozen,'src/components/BulkTagDialog')||target===resolve(frozen,'src/components/ContentList'))return resolve(root,'tests/helpers/bulk-taxonomy-source-react.tsx');
  if(target===resolve(frozen,'tests/utils/render'))return resolve(root,'tests/helpers/bulk-taxonomy-render.ts');
  if(target===resolve(frozen,'dist/styles.css'))return resolve(root,'tests/helpers/bulk-taxonomy-browser-style.css');
 }
}],resolve:{conditions:['browser']},optimizeDeps:{include:['react-dom/client','@lingui/core']},oxc:{jsx:{runtime:'automatic'}},test:{fileParallelism:false,
 include:['parity/emdash/bulk-taxonomy/source/packages/admin/tests/components/BulkTagDialog.test.tsx'],setupFiles:['parity/emdash/bulk-taxonomy/source/packages/admin/tests/setup.ts'],
 browser:{enabled:true,headless:true,provider:playwright({launchOptions:{chromiumSandbox:true,timeout:30000}}),instances:[{browser:'chromium'}],viewport:{width:1280,height:800}}
}});
