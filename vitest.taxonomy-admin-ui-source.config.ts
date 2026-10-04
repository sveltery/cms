import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { transformAsync } from '@babel/core';
import { makeConfig } from '@lingui/conf';
import { dirname, resolve } from 'node:path';

const root = import.meta.dirname;
const frozen = resolve(root, 'parity/emdash/taxonomy-admin-ui/source/packages/admin');
const helper = (name: string) => resolve(root, 'tests/helpers/taxonomy-admin-ui', name);
const linguiConfig = makeConfig({ locales: ['en'], sourceLocale: 'en', catalogs: [] });
export default defineConfig({
  plugins: [svelte({ configFile: false }), {
    name: 'whole-taxonomy-admin-ui-secured-browser-host', enforce: 'pre',
    async transform(code, id) {
      if (id.startsWith(frozen) && /\.[jt]sx?$/.test(id)) {
        const result = await transformAsync(code, { filename: id, configFile: false, babelrc: false,
          plugins: [['@lingui/babel-plugin-lingui-macro', { stripMessageField: false, linguiConfig }]],
          parserOpts: { plugins: ['typescript', 'jsx'] } });
        return result?.code ? { code: result.code, map: result.map } : null;
      }
    },
    resolveId(id, importer) {
      if (!importer?.startsWith(frozen)) return;
      if (id === 'vitest/browser') return helper('dom-user-event.ts');
      if (!id.startsWith('.')) return;
      const target = resolve(dirname(importer), id).replace(/\.(tsx?|js)$/, '');
      if (target === resolve(frozen, 'src/components/TaxonomyManager') || target === resolve(frozen, 'src/components/TaxonomySidebar')) return helper('source-react.tsx');
      if (target === resolve(frozen, 'src/router')) return helper('source-router.tsx');
      if (target === resolve(frozen, 'tests/utils/render')) return helper('dom-render.tsx');
      if (target === resolve(frozen, 'dist/styles.css')) return helper('source-style.css');
    }
  }],
  resolve: { conditions: ['browser'], dedupe: ['react', 'react-dom'] },
  oxc: { jsx: { runtime: 'automatic' } },
  test: { globals: true, fileParallelism: false, testTimeout: 15000, hookTimeout: 30000,
    browser: { enabled: true, headless: true,
      provider: playwright({
        launchOptions: { chromiumSandbox: true, timeout: 30000 },
        contextOptions: { timezoneId: 'America/New_York' }
      }),
      instances: [{ browser: 'chromium' }], viewport: { width: 1280, height: 800 }
    },
    setupFiles: ['tests/helpers/taxonomy-admin-ui/dom-setup.ts'],
    include: [
      'parity/emdash/taxonomy-admin-ui/source/packages/admin/tests/components/TaxonomyManager.test.tsx',
      'parity/emdash/taxonomy-admin-ui/source/packages/admin/tests/components/TaxonomySidebar.test.tsx',
      'parity/emdash/taxonomy-admin-ui/source/packages/admin/tests/components/taxonomy-term-cache.test.tsx',
      'parity/emdash/taxonomy-admin-ui/source/packages/admin/tests/taxonomy-sidebar-refresh.test.tsx'
    ] }
});
