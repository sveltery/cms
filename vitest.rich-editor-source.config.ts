import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
const root = import.meta.dirname;
const frozen = resolve(root, 'parity/emdash/rich-editor-source');
const targets: Record<string, string> = {
  'packages/admin/src/components/PortableTextEditor': 'src/lib/editor/portable-text/admin-converters.ts',
  'packages/admin/src/portable-text-table': 'src/lib/editor/portable-text/portable-text-table.ts',
  'packages/core/src/components/InlinePortableTextEditor': 'src/lib/editor/portable-text/inline-converters.ts',
  'packages/core/src/client/portable-text': 'src/lib/editor/portable-text/client.ts',
  'packages/core/src/content/portable-text-lists': 'src/lib/editor/portable-text/portable-text-lists.ts',
  'packages/core/src/content/converters/gallery': 'src/lib/editor/portable-text/converters/gallery.ts',
  'packages/core/src/content/converters/image-link': 'src/lib/editor/portable-text/converters/image-link.ts',
  'packages/core/src/content/converters/index': 'src/lib/editor/portable-text/converters/index.ts',
  'packages/core/src/content/converters/mark-safety': 'src/lib/editor/portable-text/converters/mark-safety.ts',
  'packages/core/src/content/converters/numbered-list': 'src/lib/editor/portable-text/converters/numbered-list.ts',
  'packages/core/src/content/converters/portable-text-identity': 'src/lib/editor/portable-text/converters/portable-text-identity.ts',
  'packages/core/src/content/converters/portable-text-to-prosemirror': 'src/lib/editor/portable-text/converters/portable-text-to-prosemirror.ts',
  'packages/core/src/content/converters/prosemirror-to-portable-text': 'src/lib/editor/portable-text/converters/prosemirror-to-portable-text.ts',
  'packages/core/src/content/converters/types': 'src/lib/editor/portable-text/converters/types.ts',
};
export default defineConfig({
  plugins: [{ name: 'whole-rich-editor-native-module-resolution', enforce: 'pre',
    resolveId(id, importer) {
      if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
      const original = resolve(dirname(importer), id).replace(/\.(tsx?|jsx?)$/, '');
      const relative = original.slice(frozen.length + 1);
      if (Object.hasOwn(targets, relative)) return resolve(root, targets[relative]);
    }
  }],
  test: { environment: 'node', fileParallelism: false, include: [
    'parity/emdash/rich-editor-source/packages/admin/tests/components/PortableTextEditor.list.test.ts',
    'parity/emdash/rich-editor-source/packages/admin/tests/components/PortableTextEditor.table.test.ts',
    'parity/emdash/rich-editor-source/packages/admin/tests/editor/PortableTextEditor.code-block.test.ts',
    'parity/emdash/rich-editor-source/packages/admin/tests/lib/portable-text-table.test.ts',
    'parity/emdash/rich-editor-source/packages/admin/tests/pt-gallery-converters.test.ts',
    'parity/emdash/rich-editor-source/packages/admin/tests/pt-image-converters.test.ts',
    'parity/emdash/rich-editor-source/packages/core/tests/unit/client/portable-text.test.ts',
    'parity/emdash/rich-editor-source/packages/core/tests/unit/content/portable-text-lists.test.ts',
    'parity/emdash/rich-editor-source/packages/core/tests/unit/converters/blockquote-grouping.test.ts',
    'parity/emdash/rich-editor-source/packages/core/tests/unit/converters/custom-block-round-trip.test.ts',
    'parity/emdash/rich-editor-source/packages/core/tests/unit/converters/gallery-round-trip.test.ts',
    'parity/emdash/rich-editor-source/packages/core/tests/unit/converters/html-block-round-trip.test.ts',
    'parity/emdash/rich-editor-source/packages/core/tests/unit/converters/iframe-round-trip.test.ts',
    'parity/emdash/rich-editor-source/packages/core/tests/unit/converters/image-alignment.test.ts',
    'parity/emdash/rich-editor-source/packages/core/tests/unit/converters/image-dimensions.test.ts',
    'parity/emdash/rich-editor-source/packages/core/tests/unit/converters/image-link.test.ts',
    'parity/emdash/rich-editor-source/packages/core/tests/unit/converters/image-missing-asset.test.ts',
    'parity/emdash/rich-editor-source/packages/core/tests/unit/converters/image-seeded-media.test.ts',
    'parity/emdash/rich-editor-source/packages/core/tests/unit/converters/linked-code-round-trip.test.ts',
    'parity/emdash/rich-editor-source/packages/core/tests/unit/converters/list-nesting.test.ts',
    'parity/emdash/rich-editor-source/packages/core/tests/unit/converters/numbered-list-continuity.test.ts',
    'parity/emdash/rich-editor-source/packages/core/tests/unit/converters/table-round-trip.test.ts',
    'parity/emdash/rich-editor-source/packages/core/tests/unit/converters/text-align-round-trip.test.ts',
    'parity/emdash/rich-editor-source/packages/core/tests/unit/converters/unsupported-portable-text-marks.test.ts',
  ] }
});
