import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
export default defineConfig({plugins:[svelte({configFile:false})],resolve:{conditions:['browser']},test:{
  include:['tests/calendar-admin-browser/*.test.ts'],fileParallelism:false,
  browser:{enabled:true,headless:true,provider:playwright({launchOptions:{chromiumSandbox:true,timeout:30000}}),instances:[{browser:'chromium'}],viewport:{width:1280,height:800}}
}});
