import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { dirname, resolve } from 'node:path';
import base from './vitest.schema-admin-ui-source.config';
const root = import.meta.dirname, frozen = resolve(root, 'parity/emdash/schema-admin-ui-source/packages/admin');
export default defineConfig({
  ...base,
  plugins: [{ name:'schema-ui-official-browser-provider', enforce:'pre', resolveId(specifier, importer) {
    if (!importer?.startsWith(frozen) || !specifier.startsWith('.')) return;
    if (resolve(dirname(importer),specifier).replace(/\.(tsx?|js)$/,'') === resolve(frozen,'tests/utils/render')) return resolve(root,'tests/helpers/schema-ui/browser-render.ts');
  } }, ...(base.plugins ?? [])],
  test: { ...base.test, environment: undefined, setupFiles: [],
    browser: { enabled:true, headless:true, provider:playwright({launchOptions:{chromiumSandbox:true,timeout:30000}}),
      instances:[{browser:'chromium'}], viewport:{width:1280,height:800} }
  }
});
