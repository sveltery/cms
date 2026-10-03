import {defineConfig} from 'vitest/config';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import react from '@vitejs/plugin-react';
import {playwright} from '@vitest/browser-playwright';
import {resolve,dirname} from 'node:path';
const root=import.meta.dirname,frozen=resolve(root,'parity/emdash/portable-text/source');
export default defineConfig({
  plugins:[svelte({configFile:false}),react({babel:{plugins:[['@lingui/babel-plugin-lingui-macro',{stripMessageField:false}]]}}),{name:'immutable-portable-text-native-host',enforce:'pre',resolveId(specifier,importer){
    if(!importer?.startsWith(frozen)||!specifier.startsWith('.'))return;
    const target=resolve(dirname(importer),specifier).replace(/\.(tsx?|js)$/,'');
    if(target.endsWith('/src/components/PortableTextEditor'))return resolve(root,'tests/helpers/portable-text-react-bridge.ts');
    if(target.endsWith('/tests/utils/render'))return resolve(root,'tests/helpers/portable-text-browser-render.ts');
    if(target.endsWith('/dist/styles.css'))return resolve(root,'tests/helpers/portable-text-browser-style.css');
    for(const name of ['MediaPickerModal','SectionPickerModal','DragHandleWrapper'])if(target.endsWith('/'+name))return resolve(root,'tests/helpers/portable-text-'+name+'-host.ts');
    if(target.endsWith('/editor/ImageNode'))return resolve(root,'src/lib/portable-text/basic-nodes.ts');
    if(target.endsWith('/editor/PluginBlockNode'))return resolve(root,'src/lib/portable-text/basic-nodes.ts');
  }}],
  optimizeDeps:{include:['react-dom/client','@tiptap/react','@tiptap/pm/tables','@testing-library/react','@lingui/core']},
  test:{include:[
    'parity/emdash/portable-text/source/packages/admin/tests/editor/PortableTextEditor.test.tsx',
    'parity/emdash/portable-text/source/packages/admin/tests/components/PortableTextEditor.footer.test.tsx'
  ],setupFiles:['parity/emdash/portable-text/source/packages/admin/tests/setup.ts'],
    browser:{enabled:true,headless:true,viewport:{width:1280,height:800},provider:playwright({launchOptions:{chromiumSandbox:true,timeout:30000}}),instances:[{browser:'chromium'}]}}
});
