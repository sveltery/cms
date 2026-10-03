import { defineConfig } from 'vitest/config';
import { transformAsync } from '@babel/core';
import { makeConfig } from '@lingui/conf';
const frozen = `${import.meta.dirname}/parity/emdash/writable-editor-source/packages/admin/`;
const linguiConfig = makeConfig({ locales: ['en'], sourceLocale: 'en', catalogs: [] });
export default defineConfig({ plugins: [{ name: 'whole-pinned-validation-diagnostic', enforce: 'pre',
  async transform(code, id) {
    if (!id.startsWith(frozen) || !/\.[jt]sx?$/.test(id)) return;
    const result = await transformAsync(code, { filename: id, configFile: false, babelrc: false,
      plugins: [['@lingui/babel-plugin-lingui-macro', { stripMessageField: false, linguiConfig }]],
      parserOpts: { plugins: ['typescript', 'jsx'] } });
    return result?.code ? { code: result.code, map: result.map } : null;
  }
}], test: { environment: 'node', include: ['tests/writable-editor-reference/*.test.ts'] } });
