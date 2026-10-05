import { defineConfig } from 'vitest/config';
import richEditor from './vitest.rich-editor-browser.config';

export default defineConfig({
  ...richEditor,
  test: {
    ...richEditor.test,
    include: ['parity/emdash/rich-editor-source/packages/admin/tests/editor/html-block-editor.test.tsx']
  }
});
