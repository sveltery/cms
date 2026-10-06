import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { transformAsync } from '@babel/core';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
const root=import.meta.dirname,frozen=resolve(root,'parity/emdash/entry-locks/source/packages/admin');
export default defineConfig({plugins:[{
 name:'whole-entry-lock-reference-browser-macros',enforce:'pre',
 resolveId(id,importer){
  if(!importer?.startsWith(frozen)||!id.startsWith('.'))return;
  const target=resolve(dirname(importer),id).replace(/\.(js|tsx?)$/,'');
  for(const suffix of ['.ts','.tsx'])if(existsSync(target+suffix))return target+suffix;
 },
 async transform(code,id){
  const file=id.split('?')[0];
  if(!file.startsWith(frozen)||!/^.*\.tsx?$/.test(file))return;
  const result=await transformAsync(code,{filename:file,configFile:false,babelrc:false,
   parserOpts:{plugins:['typescript','jsx']},plugins:[['@lingui/babel-plugin-lingui-macro',{stripMessageField:false}]],sourceMaps:true});
  return result?.code?{code:result.code,map:result.map}:null;
 }
}],resolve:{dedupe:['react','react-dom'],conditions:['browser']},oxc:{jsx:{runtime:'automatic'}},
 test:{fileParallelism:false,setupFiles:['parity/emdash/entry-locks/source/packages/admin/tests/setup.ts'],
 include:['parity/emdash/entry-locks/source/packages/admin/tests/components/EntryLockNotice.test.tsx','parity/emdash/entry-locks/source/packages/admin/tests/lib/useEntryLock.test.tsx'],
 browser:{enabled:true,headless:true,provider:playwright({contextOptions:{timezoneId:'America/New_York'},launchOptions:{chromiumSandbox:true,timeout:30000}}),instances:[{browser:'chromium'}],viewport:{width:1280,height:800}}}
});
