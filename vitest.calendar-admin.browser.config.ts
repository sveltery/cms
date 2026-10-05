import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { resolve,dirname } from 'node:path';
const root=import.meta.dirname,frozen=resolve(root,'parity/emdash/scheduled-publishing-source/upstream/packages/admin');
export default defineConfig({plugins:[svelte({configFile:false}),{
  name:'whole-calendar-admin-production-Svelte-host',enforce:'pre',
  resolveId(id,importer){
    if(id==='$app/paths')return '\0calendar-admin-browser-base';
    if(!importer?.startsWith(frozen)||!id.startsWith('.'))return;
    const target=resolve(dirname(importer),id).replace(/\.(tsx?|js)$/,'');
    if(target===resolve(frozen,'src/lib/calendar'))return resolve(root,'src/lib/calendar/calendar.ts');
    if(target===resolve(frozen,'src/lib/api/calendar'))return resolve(root,'src/lib/calendar/api.ts');
    if(['src/lib/api/client','src/lib/api/content'].some(path=>target===resolve(frozen,path)))return resolve(root,'src/lib/calendar/client.ts');
    if(target===resolve(frozen,'src/lib/api/current-user'))return resolve(root,'tests/helpers/calendar-admin/current-user.ts');
    if(target===resolve(frozen,'src/routes/calendar')||target.startsWith(resolve(frozen,'src/components/calendar/')))return resolve(root,'tests/helpers/calendar-admin/react-bridge.tsx');
    if(target===resolve(frozen,'dist/styles.css'))return '\0calendar-admin-source-style';
  },load(id){if(id==='\0calendar-admin-browser-base')return "export const base='';";if(id==='\0calendar-admin-source-style')return '';}
}],resolve:{conditions:['browser']},oxc:{jsx:{runtime:'automatic'}},test:{fileParallelism:false,
  setupFiles:['parity/emdash/scheduled-publishing-source/upstream/packages/admin/tests/setup.ts'],
  include:['parity/emdash/scheduled-publishing-source/upstream/packages/admin/tests/lib/calendar.test.ts','parity/emdash/scheduled-publishing-source/upstream/packages/admin/tests/components/calendar/*.test.tsx','parity/emdash/scheduled-publishing-source/upstream/packages/admin/tests/routes/calendar.test.tsx'],
  browser:{enabled:true,headless:true,provider:playwright({contextOptions:{timezoneId:'America/New_York'},launchOptions:{chromiumSandbox:true,timeout:30000}}),instances:[{browser:'chromium'}],viewport:{width:1280,height:800}}
}});
