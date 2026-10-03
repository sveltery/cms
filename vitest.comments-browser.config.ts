import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { resolve, dirname } from 'node:path';
const root=import.meta.dirname;
const source=resolve(root,'tests/comments-source/packages/admin');
export default defineConfig({plugins:[svelte({configFile:false}),{name:'comments-whole-source-native-host',enforce:'pre',resolveId(specifier,importer){
 if(!importer?.startsWith(source)||!specifier.startsWith('.'))return;
 const target=resolve(dirname(importer),specifier).replace(/\.(tsx?|js)$/,'');
 if(target===resolve(source,'src/components/comments/CommentInbox'))return resolve(root,'tests/helpers/comments/inbox-react.tsx');
 if(target===resolve(source,'tests/utils/render'))return resolve(root,'tests/helpers/comments/inbox-render.ts');
}}],resolve:{conditions:['browser']},optimizeDeps:{include:['react-dom/client','@lingui/core']},oxc:{jsx:{runtime:'automatic'}},test:{include:['tests/comments-source/packages/admin/tests/components/CommentInbox.test.tsx'],fileParallelism:false,browser:{enabled:true,headless:true,provider:playwright({launchOptions:{chromiumSandbox:true,timeout:30000}}),instances:[{browser:'chromium'}],viewport:{width:1280,height:800}}}});
