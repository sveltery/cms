import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const source=path.join(root,'parity/emdash/general-media-source/upstream/packages/cloudflare');
export default defineConfig({plugins:[{name:'whole-original-r2-class-native-binding-host',enforce:'pre',resolveId(id,importer){
  if(importer?.startsWith(source)&&id==='../../src/storage/r2.js')return path.join(root,'src/lib/server/general-media/r2-storage.ts');
}}],test:{environment:'node',include:['parity/emdash/general-media-source/upstream/packages/cloudflare/tests/storage/r2.test.ts']}});
