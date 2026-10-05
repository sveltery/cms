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
      // The actual SvelteKit config has its default empty base; only this
      // framework value is adapted. Original mocked Source providers stay intact.
      if (id === '$app/paths') return '\0rich-editor-native-default-base';
      if (!importer || !id.startsWith('.')) return;
      const target = resolve(dirname(importer.split('?')[0]), id).replace(/\.(tsx?|jsx?)$/, '');
      if (target === resolve(source, 'src/components/PortableTextEditor')) return resolve(helper, 'react-bridge.tsx');
      if (target === resolve(source, 'src/components/editor/ImageNode')) return resolve(native, 'image-node.ts');
      if (target === resolve(source, 'src/components/editor/PluginBlockNode')) return resolve(native, 'plugin-node.ts');
      if (target === resolve(source, 'dist/styles.css') || target === resolve(source, 'src/styles.css')) return resolve(native, 'editor.css');
    },
    load(id) { if (id === '\0rich-editor-native-default-base') return "export const base = '';"; },
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
  // The whole Source families retain original provider mocks. Do not scan those
  // mocked module bodies: their unmounted React providers are not prerequisites
  // of the Native editor. Prebundle the actual harness/authoring graph before
  // setup so lazy editor loading cannot reload an active Vitest runner.
  optimizeDeps: {
    noDiscovery: true,
    include: [
      'react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime',
      'vitest-browser-react', '@testing-library/react', '@lingui/core', '@lingui/react', '@tanstack/react-query',
      '@tiptap/core', '@tiptap/react', '@tiptap/starter-kit', '@tiptap/suggestion',
      '@tiptap/pm/model', '@tiptap/pm/state', '@tiptap/pm/view', '@tiptap/pm/tables', '@tiptap/pm/history', '@tiptap/pm/transform',
      '@tiptap/extension-character-count', '@tiptap/extension-code', '@tiptap/extension-code-block-lowlight',
      '@tiptap/extension-focus', '@tiptap/extension-link', '@tiptap/extension-list', '@tiptap/extension-placeholder',
      '@tiptap/extension-subscript', '@tiptap/extension-superscript', '@tiptap/extension-text-align',
      '@tiptap/extension-typography', '@tiptap/extension-table', '@tiptap/extension-table-cell',
      '@tiptap/extension-table-header', '@tiptap/extension-table-row',
      'lowlight', 'highlight.js/lib/languages/dockerfile'
    ]
  },
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
