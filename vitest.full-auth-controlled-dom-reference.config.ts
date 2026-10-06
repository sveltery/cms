import { defineConfig } from 'vitest/config';
import referenceConfig from './vitest.full-auth-isolated-reference.config.ts';
import { originalLinguiMacroHost } from './scripts/full-auth-original-macro-host.mjs';
export default defineConfig({...referenceConfig,plugins:[originalLinguiMacroHost({originalAdminTest:true}),...(referenceConfig.plugins??[])],test:{...referenceConfig.test,environment:'jsdom',include:['parity/emdash/full-auth-source/reference/packages/admin/tests/lib/{api-token-scopes-contract,webauthn-environment}.test.mjs']}});
