import { defineConfig } from 'vitest/config';
import {resolve} from 'node:path';

export default defineConfig({plugins:[{
 name:'selected-settings-media-native-host',enforce:'pre',
 resolveId(specifier,importer){
  if(importer!==resolve(import.meta.dirname,'tests/source-port/settings/media-settings.test.ts'))return;
  if(specifier==='../../utils/mcp-runtime.js')return resolve(import.meta.dirname,'tests/helpers/settings-media-runtime.ts');
  if(specifier==='../../utils/test-db.js')return resolve(import.meta.dirname,'tests/helpers/settings-media-database.ts');
 }
}],test: { include: ['tests/source-port/**/*.test.ts'], environment: 'node', globalSetup:['tests/helpers/source-port-native-build.ts'] } });
