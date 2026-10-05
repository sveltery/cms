// Supplemental actual Native menu requirements from whole pinned
// packages/admin/src/components/editor/TableControls.tsx. These are separate
// from the immutable original 35-declaration browser family.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { TextSelection } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import type { Editor } from '@tiptap/core';
import { paragraph, renderInDraftForm } from '../helpers/rich-editor/native-authoring-dom';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const release of cleanup.splice(0)) await release(); });
async function render() { const result = await renderInDraftForm(); cleanup.push(result.cleanup); return result; }
function cells(editor: Editor) {
  const result: number[] = [];
  editor.state.doc.descendants((node, position) => { if (['cell', 'header_cell'].includes(node.type.spec.tableRole)) result.push(position); });
  return result;
}
function table(editor: Editor) {
  editor.commands.setContent({ type: 'doc', content: [{ type: 'table', content: [0, 1].map(row => ({
    type: 'tableRow', content: [0, 1].map(column => ({ type: row === 0 && column === 0 ? 'tableHeader' : 'tableCell',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: `${row}:${column}` }] }] }))
  })) }, { type: 'paragraph' }] });
  const positions = cells(editor);
  editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, positions[3])));
  return positions;
}
function trigger(host: HTMLElement) { return host.querySelector<HTMLButtonElement>('button[aria-label="Table"]')!; }
function menu(host: HTMLElement) { return host.querySelector<HTMLElement>('[role="menu"][aria-label="Table actions"]'); }
function action(host: HTMLElement, label: string) { return [...host.querySelectorAll<HTMLButtonElement>('[aria-label="Table actions"] button')].find(button => button.textContent?.trim() === label)!; }

describe('Actual Native table toolbar menu contract', () => {
  it('moves focus with Alt+F10 and restores the saved selection on trigger Escape', async () => {
    const { host, editor } = await render(); editor.commands.setTextSelection({ from: 2, to: 4 }); editor.view.focus();
    const saved = editor.state.selection.toJSON();
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', altKey: true, bubbles: true })); await tick();
    expect(document.activeElement).toBe(trigger(host));
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1)));
    trigger(host).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await tick();
    expect(editor.state.selection.toJSON()).toEqual(saved); expect(editor.view.hasFocus()).toBe(true);
  });

  it('renders all eight action groups and independent mixed header checkbox states', async () => {
    const { host, editor } = await render(); table(editor); await tick(); trigger(host).click(); await tick();
    expect([...menu(host)!.querySelectorAll('[role="group"]')].map(group => group.getAttribute('aria-label')))
      .toEqual(['Selection', 'Rows', 'Columns', 'Headers', 'Cells', 'Widths', 'Document', 'Table']);
    const headers = menu(host)!.querySelectorAll('[role="menuitemcheckbox"]');
    expect(headers).toHaveLength(2); expect([...headers].map(item => item.getAttribute('aria-checked'))).toEqual(['mixed', 'mixed']);
  });

  it('labels plural deletion actions from the actual selected rectangle', async () => {
    const { host, editor } = await render(); const positions = table(editor);
    editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, positions[0], positions[3])));
    await tick(); trigger(host).click(); await tick();
    expect(menu(host)!.textContent).toContain('2 rows × 2 columns selected');
    expect(action(host, 'Delete rows')).toBeTruthy(); expect(action(host, 'Delete columns')).toBeTruthy();
  });

  it('restores a menu Escape bookmark without overwriting command-produced selection', async () => {
    const { host, editor } = await render(); const positions = table(editor); await tick();
    const saved = editor.state.selection.toJSON(); trigger(host).click(); await tick();
    menu(host)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await tick();
    expect(menu(host)).toBeNull(); expect(editor.state.selection.toJSON()).toEqual(saved); expect(editor.view.hasFocus()).toBe(true);
    trigger(host).click(); await tick(); action(host, 'Select row').click(); await tick();
    expect(editor.state.selection).toBeInstanceOf(CellSelection); expect(editor.state.selection.eq(CellSelection.create(editor.state.doc, positions[2], positions[3]))).toBe(true);
    expect(menu(host)).toBeNull();
  });

  it('closes on outside focus without stealing focus or restoring an unrelated selection', async () => {
    const { host, editor, save } = await render(); table(editor); await tick(); trigger(host).click(); await tick();
    save.focus(); save.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); save.click(); await tick();
    expect(menu(host)).toBeNull(); expect(document.activeElement).toBe(save);
  });

  it('inserts through the toolbar at the actual saved selection between existing paragraphs', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    try {
      const { host, editor } = await render();
      editor.commands.setContent({ type: 'doc', content: [paragraph('first', 'First'), paragraph('last', 'Last')].map(block => ({
        type: 'paragraph', content: [{ type: 'text', text: block._key === 'first' ? 'First' : 'Last' }]
      })) });
      editor.commands.setTextSelection(editor.state.doc.firstChild!.nodeSize + 1); await tick(); trigger(host).click(); await tick();
      action(host, 'Insert table').click(); await tick();
      await vi.waitFor(() => expect(host.querySelector('[role="gridcell"][aria-label="1 × 1 table"]')).toBeTruthy());
      host.querySelector<HTMLButtonElement>('[role="gridcell"][aria-label="1 × 1 table"]')!.click(); await tick();
      expect(editor.state.doc.content.content.map(node => node.type.name)).toEqual(['paragraph', 'table', 'paragraph']);
      expect(editor.state.doc.lastChild!.textContent).toBe('Last');
    } finally { vi.unstubAllGlobals(); }
  });

  it('keeps header checkboxes open and focused across actual document changes', async () => {
    const { host, editor } = await render(); table(editor); await tick(); trigger(host).click(); await tick();
    const current = menu(host)!; const header = current.querySelector<HTMLButtonElement>('[role="menuitemcheckbox"]')!;
    header.focus(); header.click(); await tick();
    expect(menu(host)).toBe(current); expect(document.activeElement).toBe(header); expect(header.getAttribute('aria-checked')).toBe('true');
    header.click(); await tick(); expect(menu(host)).toBe(current); expect(header.getAttribute('aria-checked')).toBe('false');
  });

  it('opens from ArrowDown and performs the Source500ms case-insensitive menu typeahead', async () => {
    const { host, editor } = await render(); table(editor); await tick(); trigger(host).focus();
    trigger(host).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); await tick();
    expect(menu(host)).toBeTruthy(); expect(document.activeElement?.textContent?.trim()).toBe('Select row');
    vi.useFakeTimers();
    try {
      menu(host)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', bubbles: true, cancelable: true })); await tick();
      expect(document.activeElement?.textContent?.trim()).toBe('Delete row');
      await vi.advanceTimersByTimeAsync(499);
      menu(host)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true, cancelable: true })); await tick();
      expect(document.activeElement?.textContent?.trim()).toBe('Delete row');
      await vi.advanceTimersByTimeAsync(500);
      menu(host)!.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true, cancelable: true })); await tick();
      expect(document.activeElement?.textContent?.trim()).toBe('Split merged cell');
    } finally { vi.useRealTimers(); }
  });

  it('keeps an unavailable action focusable while actual click remains a guarded no-op', async () => {
    const { host, editor } = await render(); table(editor); await tick(); trigger(host).click(); await tick();
    const unavailable = action(host, 'Split merged cell'), before = editor.getJSON();
    expect(unavailable.getAttribute('aria-disabled')).toBe('true');
    unavailable.focus(); expect(document.activeElement).toBe(unavailable); unavailable.click(); await tick();
    expect(editor.getJSON()).toEqual(before); expect(menu(host)).toBeTruthy();
  });

  it('updates the actual live region for repeated identical table action results', async () => {
    const { host, editor } = await render(); table(editor); await tick();
    trigger(host).click(); await tick(); action(host, 'Add row below').click(); await tick();
    const status = host.querySelector<HTMLElement>('[aria-live="polite"][aria-atomic="true"]')!;
    expect(status.textContent).toBe('Row added below'); const first = status.firstChild;
    trigger(host).click(); await tick(); action(host, 'Add row below').click(); await tick();
    expect(editor.state.doc.firstChild!.childCount).toBe(4); expect(status.textContent).toBe('Row added below'); expect(status.firstChild).not.toBe(first);
  });
});
