// Supplemental real catalog integration. IDs are taken from the immutable
// Source Lingui compilation, not English matching or a simulated translator.
import { afterEach, expect, it, vi } from 'vitest';
import { setupI18n } from '@lingui/core';
import { mount, tick, unmount } from 'svelte';
import TableSizePicker from '../../src/lib/editor/rich-text/TableSizePicker.svelte';
import TableSelectionAnnouncer from '../../src/lib/editor/rich-text/TableSelectionAnnouncer.svelte';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { CellSelection } from '@tiptap/pm/tables';
import { EmDashTable, EmDashTableCell, EmDashTableHeader, EmDashTableRow, TableIdentity } from '../../src/lib/editor/rich-text/TableExtensions';
import type { Translate } from '../../src/lib/editor/rich-text/types';
const releases: (() => Promise<void>)[] = [];
afterEach(async () => { for (const release of releases.splice(0)) await release(); vi.unstubAllGlobals(); });
it('uses actual Source catalog IDs for picker controls and interpolated dimensions', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  // Fixed IDs independently read from the pinned Source macro output.
  const i18n = setupI18n({ locale: 'es', messages: { es: {
    'Gi0VDy': 'Fila de encabezado', 'y9fIj7': 'Tamaño de tabla',
    'wcydjE': 'Tabla {row} × {column}', 'QtjT8L': 'Vista {previewRows} × {previewColumns}'
  } } });
  const host = document.createElement('div'); document.body.append(host);
  const translate: Translate = descriptor => typeof descriptor === 'string' ? i18n._(descriptor) : i18n._(descriptor);
  const props = { translate, onInsert: vi.fn(), onCancel: vi.fn() };
  const instance = mount(TableSizePicker, { target: host, props }); releases.push(async () => { await unmount(instance); host.remove(); });
  await tick(); await tick();
  expect(host.querySelector('[role="grid"]')!.getAttribute('aria-label')).toBe('Tamaño de tabla');
  expect(host.querySelector('label')!.textContent).toContain('Fila de encabezado');
  expect(host.querySelector('[role="gridcell"]')!.getAttribute('aria-label')).toBe('Tabla 1 × 1');
  expect(host.querySelector('p')!.textContent).toBe('Vista 1 × 1');
});

it.each([
  ['row', 5, '2 filas × 3 columnas seleccionadas', '2 filas eliminadas', 1],
  ['column', 7, '3 filas × 2 columnas seleccionadas', '2 columnas eliminadas', 3]
] as const)('announces real %s selection and structural deletion through the original catalog IDs', async (_axis, last, selection, deletion, rows) => {
  const i18n = setupI18n({ locale: 'es', messages: { es: {
    '7RGTJ4': '{0, plural, one {# fila} other {# filas}} × {1, plural, one {# columna} other {# columnas}} seleccionadas',
    '/xOaKh': '{rows, plural, one {Fila eliminada} other {# filas eliminadas}}',
    'e2u9PQ': '{columns, plural, one {Columna eliminada} other {# columnas eliminadas}}'
  } } });
  const host = document.createElement('div'), content = document.createElement('div'); document.body.append(host, content);
  const editor = new Editor({ element: content, extensions: [StarterKit, EmDashTable.configure({ resizable: false }), EmDashTableRow,
    EmDashTableHeader, EmDashTableCell, TableIdentity], content: { type: 'doc', content: [{ type: 'table', content: [0, 1, 2].map(row => ({
      type: 'tableRow', content: [0, 1, 2].map(column => ({ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: `${row}:${column}` }] }] }))
    })) }, { type: 'paragraph' }] }, editorProps: { attributes: { tabindex: '0' }, handleScrollToSelection: () => true } });
  const positions: number[] = []; editor.state.doc.descendants((node, position) => { if (node.type.name === 'tableCell') positions.push(position); });
  const onChange = vi.fn(); const translate: Translate = descriptor => typeof descriptor === 'string' ? i18n._(descriptor) : i18n._(descriptor);
  const instance = mount(TableSelectionAnnouncer, { target: host, props: { editor, onChange, translate } });
  releases.push(async () => { await unmount(instance); editor.destroy(); host.remove(); content.remove(); }); await tick();
  editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, positions[0], positions[last]))); await tick();
  expect(onChange.mock.lastCall?.[0]).toBe(selection); onChange.mockClear();
  editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true })); await tick();
  expect(editor.state.doc.firstChild!.childCount).toBe(rows); expect(onChange.mock.lastCall?.[0]).toBe(deletion);
});
