import { defineConfig } from 'vitest/config';
import referenceConfig from './vitest.full-auth-isolated-reference.config.ts';
import { originalLinguiMacroHost } from './scripts/full-auth-original-macro-host.mjs';
export default defineConfig({...referenceConfig,plugins:[originalLinguiMacroHost(),...(referenceConfig.plugins??[])],test:{...referenceConfig.test,include:(referenceConfig.test?.include??[]).filter((name:string)=>!name.includes('packages/admin/'))}});
