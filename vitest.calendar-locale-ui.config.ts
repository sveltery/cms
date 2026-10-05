// Controlled Native production locale wiring; whole original locale tests stay separate.
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({plugins:[svelte({configFile:false}),{
  name:'calendar-locale-ui-controlled-base',enforce:'pre',
  resolveId(id){if(id==='$app/paths')return '\0calendar-locale-ui-base';},
  load(id){if(id==='\0calendar-locale-ui-base')return "export const base='';";}
}],test:{environment:'node',fileParallelism:false,include:['tests/calendar-locale-ui/*.test.ts']}});
