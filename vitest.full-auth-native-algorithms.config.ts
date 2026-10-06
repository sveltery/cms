import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import referenceConfig from './vitest.full-auth-isolated-reference.config.ts';
const replacements=new Map(['invite','signup','magic-link/index'].map(name=>[`${name}.js`,resolve(import.meta.dirname,`src/lib/server/auth/vendor/${name}.ts`)]));
export default defineConfig({...referenceConfig,plugins:[{name:'whole-native-auth-algorithm-handoff',enforce:'pre',resolveId(id,importer){
 if(!importer?.includes('/parity/emdash/full-auth-source/reference/packages/auth/src/'))return;
 const path=id.replace(/^\.\//,'');if(replacements.has(path))return replacements.get(path);
}},...(referenceConfig.plugins??[])],test:{...referenceConfig.test,include:[
 'parity/emdash/full-auth-source/reference/packages/auth/src/email-templates.test.mjs',
 'parity/emdash/full-auth-source/reference/packages/core/tests/unit/auth/{invite,signup,magic-link}.test.mjs'
]}});
