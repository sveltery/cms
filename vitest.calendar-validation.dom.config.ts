import {defineConfig} from 'vitest/config';
import {svelte} from '@sveltejs/vite-plugin-svelte';
export default defineConfig({plugins:[svelte({configFile:false}),{
  name:'calendar-validation-controlled-kit-base',enforce:'pre',
  resolveId(id){if(id==='$app/paths')return'\0calendar-validation-base';},
  load(id){if(id==='\0calendar-validation-base')return"export const base='';";}
}],resolve:{conditions:['browser']},test:{environment:'jsdom',fileParallelism:false,
  include:['tests/calendar-validation/*.dom.ts'],env:{TZ:'America/New_York'}}});
