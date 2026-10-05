import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';
import { transformAsync } from '@babel/core';
import { makeConfig } from '@lingui/conf';
const sourceCodeEditor = resolve(import.meta.dirname, 'parity/emdash/rich-editor-source/packages/admin/src/components/editor/CodeEditor.tsx');
const linguiConfig = makeConfig({ locales: ['en'], sourceLocale: 'en', catalogs: [] });
export default defineConfig({ plugins: [{
  name: 'immutable-source-code-editor-runtime-witness', enforce: 'pre',
  async transform(code, id) {
    if (id.split('?')[0] !== sourceCodeEditor) return;
    const result = await transformAsync(code, {
      filename: sourceCodeEditor, babelrc: false, configFile: false,
      parserOpts: { plugins: ['typescript', 'jsx'] },
      plugins: [['@lingui/babel-plugin-lingui-macro', { stripMessageField: false, linguiConfig }]],
      sourceMaps: true, inputSourceMap: false,
      caller: { name: 'whole-source-code-editor-runtime-witness', supportsStaticESM: true },
    });
    return result?.code ? { code: result.code, map: result.map } : undefined;
  }
}, svelte({ configFile: false })], resolve: { alias: { $lib: resolve(import.meta.dirname, 'src/lib') }, conditions: ['browser'] },
  test: { environment: 'jsdom', fileParallelism: false, include: ['tests/rich-editor-native/*.test.ts'] } });
