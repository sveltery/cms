import {defineConfig} from 'vitest/config';
import {svelte} from '@sveltejs/vite-plugin-svelte';
export default defineConfig({plugins:[svelte({configFile:false}),{
  name:'calendar-picker-handoff-controlled-kit-base',enforce:'pre',
  resolveId(id){if(id==='$app/paths')return'\0calendar-picker-handoff-base';},
  load(id){if(id==='\0calendar-picker-handoff-base')return"export const base='';";}
}],resolve:{conditions:['browser']},test:{environment:'jsdom',fileParallelism:false,
  include:['tests/calendar-picker-keyboard/*.dom.ts'],env:{TZ:'America/New_York'}}});
