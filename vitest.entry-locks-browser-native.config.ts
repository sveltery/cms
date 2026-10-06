import {defineConfig} from 'vitest/config';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {resolve,dirname} from 'node:path';
import reference from './vitest.entry-locks-browser-reference.config.ts';
const root=import.meta.dirname,frozen=resolve(root,'parity/emdash/entry-locks/source/packages/admin');
export default defineConfig({...reference,plugins:[svelte({configFile:false}),{
 name:'whole-entry-lock-browser-actual-native-boundaries',enforce:'pre',resolveId(id,importer){
  if(id==='$app/paths')return'\0entry-lock-native-controlled-base';
  if(!importer?.startsWith(frozen)||!id.startsWith('.'))return;
  const target=resolve(dirname(importer),id).replace(/\.(js|tsx?)$/,'');
  if(target===resolve(frozen,'src/components/EntryLockNotice')||target===resolve(frozen,'src/lib/useEntryLock'))return resolve(root,'tests/helpers/entry-locks/native-react-bridge.tsx');
  if(target===resolve(frozen,'src/lib/api/entry-lock'))return resolve(root,'src/lib/entry-locks/client.ts');
  if(target===resolve(frozen,'src/lib/api/client'))return resolve(root,'src/lib/sections-widgets/client.ts');
 },load(id){if(id==='\0entry-lock-native-controlled-base')return"export const base='';";}
},...(reference.plugins??[])]});
