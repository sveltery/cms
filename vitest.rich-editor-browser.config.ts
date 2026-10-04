import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { transformAsync } from '@babel/core';
import { makeConfig } from '@lingui/conf';
import { dirname, resolve } from 'node:path';
const root = import.meta.dirname;
const source = resolve(root, 'parity/emdash/rich-editor-source/packages/admin');
const helper = resolve(root, 'tests/helpers/rich-editor');
const native = resolve(root, 'src/lib/editor/rich-text');
const linguiConfig = makeConfig({ locales: ['en'], sourceLocale: 'en', catalogs: [] });
export default defineConfig({
  plugins: [{
    name: 'whole-rich-editor-source-native-transport', enforce: 'pre',
    resolveId(id, importer) {
      if (!importer || !id.startsWith('.')) return;
      const target = resolve(dirname(importer.split('?')[0]), id).replace(/\.(tsx?|jsx?)$/, '');
      if (target === resolve(source, 'src/components/PortableTextEditor')) return resolve(helper, 'react-bridge.tsx');
      if (target === resolve(source, 'src/components/editor/ImageNode')) return resolve(native, 'image-node.ts');
      if (target === resolve(source, 'src/components/editor/PluginBlockNode')) return resolve(native, 'plugin-node.ts');
      if (target === resolve(source, 'dist/styles.css') || target === resolve(source, 'src/styles.css')) return resolve(native, 'editor.css');
    },
    async transform(code, id) {
      if (!id.startsWith(source) || !/\.[jt]sx?(?:\?|$)/.test(id) || !code.includes('@lingui/')) return;
      const result = await transformAsync(code, {
        filename: id.split('?')[0], babelrc: false, configFile: false,
        parserOpts: { plugins: ['typescript', 'jsx'] },
        plugins: [['@lingui/babel-plugin-lingui-macro', { stripMessageField: false, linguiConfig }]],
        sourceMaps: true, inputSourceMap: false,
        caller: { name: 'whole-rich-editor-native-test-transport', supportsStaticESM: true },
      });
      return result?.code ? { code: result.code, map: result.map } : undefined;
    }
  }, svelte({ configFile: false })],
  resolve: { alias: { $lib: resolve(root, 'src/lib') }, conditions: ['browser'] },
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    fileParallelism: false,
    setupFiles: [resolve(source, 'tests/setup.ts')],
    include: [
      'parity/emdash/rich-editor-source/packages/admin/tests/editor/PortableTextEditor.test.tsx',
      'parity/emdash/rich-editor-source/packages/admin/tests/editor/slash-menu.test.tsx',
      'parity/emdash/rich-editor-source/packages/admin/tests/components/PortableTextEditor.footer.test.tsx'
    ],
    browser: {
      enabled: true, headless: true,
      provider: playwright({ launchOptions: { chromiumSandbox: true, timeout: 30_000 }, contextOptions: { timezoneId: 'America/New_York' } }),
      instances: [{ browser: 'chromium' }], viewport: { width: 1280, height: 800 }
    }
  }
});
