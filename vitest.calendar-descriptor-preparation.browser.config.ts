// Controlled display host; Kit base forwarding grants no actual Native URL credit.
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
export default defineConfig({plugins:[svelte({configFile:false}),{
  name:'calendar-descriptor-controlled-kit-base',enforce:'pre',
  resolveId(id){if(id==='$app/paths')return'\0calendar-descriptor-base';},
  load(id){if(id==='\0calendar-descriptor-base')return"export const base='';";}
}],resolve:{conditions:['browser']},test:{
  include:['tests/calendar-descriptor-preparation/*.browser.ts'],fileParallelism:false,
  browser:{enabled:true,headless:true,provider:playwright({launchOptions:{chromiumSandbox:true,timeout:30000},contextOptions:{timezoneId:'America/New_York'}}),instances:[{browser:'chromium'}],viewport:{width:1280,height:800}}
}});
