import { defineConfig } from 'vitest/config';
import richEditor from './vitest.rich-editor-browser.config.ts';

export default defineConfig({
  ...richEditor,
  test: {
    ...richEditor.test,
    include: ['parity/emdash/rich-editor-source/packages/admin/tests/editor/html-block-editor.test.tsx']
  }
});
