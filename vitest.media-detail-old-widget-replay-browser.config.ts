// Diagnostic only: exact public pre-review widget, with unchanged whole tests.
// No product values, child callbacks, Source assertions or browser policy change.
import {defineConfig} from 'vitest/config';
import {resolve} from 'node:path';
import completeConfig from './vitest.media-detail-complete-browser.config.ts';
const root=import.meta.dirname;
const original=resolve(root,'src/lib/media/MediaDetails.svelte');
const fixture=resolve(root,'src/lib/media/MediaDetails.pre-review-fixture.svelte');
const bridge=resolve(root,'tests/helpers/media-panel-react-bridge.ts');
export default defineConfig({...completeConfig,plugins:[{
 name:'diagnostic-exact-public-pre-review-widget',enforce:'pre',
 async resolveId(id,importer){
  const path=importer?.split('?')[0];
  if(path===bridge&&id==='../../src/lib/media/MediaDetails.svelte')return fixture;
  // Retain the existing finite actual-native relative import/mock transports.
  if(path===fixture&&id.startsWith('.'))return this.resolve(id,original,{skipSelf:true});
 },
},...(completeConfig.plugins??[])]});
