// Supplemental Native focus requirements from exact pinned Kumo2.6
// DropdownMenu -> Menu.Root(ra) -> useListNavigation(Bc). Menu.Root defaults
// highlightItemOnHover:true, with focusable unavailable menu items. These
// mounted DOM callbacks earn no original Source or browser geometry credit.
import { afterEach, describe, expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { CellSelection } from '@tiptap/pm/tables';
import type { Editor } from '@tiptap/core';
import TableMenu from '../../src/lib/editor/rich-text/TableMenu.svelte';
import { renderInDraftForm } from '../helpers/rich-editor/native-authoring-dom';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
async function render() {
  const result = await renderInDraftForm(); cleanups.push(result.cleanup); return result;
}
function selectTableCell(editor: Editor) {
  editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
  let cell = -1;
  editor.state.doc.descendants((node, position) => { if (cell < 0 && node.type.name === 'tableCell') cell = position; });
  editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cell)));
}
function action(host: HTMLElement, label: string) {
  return [...host.querySelectorAll<HTMLButtonElement>('[role="menu"] button')].find(button => button.textContent?.trim() === label)!;
}
async function moveMouse(button: HTMLButtonElement) {
  button.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })); await tick();
}
async function openToolbar(host: HTMLElement) {
  await tick(); host.querySelector<HTMLButtonElement>('[data-emdash-table-trigger]')!.click(); await tick();
}

describe('Source menu pointer focus in the actual Native editor', () => {
  it('moves focus and subsequent keyboard navigation to the hovered toolbar action', async () => {
    const { host, editor } = await render(); selectTableCell(editor); await openToolbar(host);
    expect(document.activeElement).toBe(action(host, 'Select row'));
    const target = action(host, 'Delete row'); await moveMouse(target);
    expect(document.activeElement).toBe(target); expect(target.tabIndex).toBe(0);
    expect(action(host, 'Select row').tabIndex).toBe(-1);
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); await tick();
    expect(document.activeElement).toBe(action(host, 'Select column'));
  });

  it('focuses an unavailable hovered action while its actual click remains a no-op', async () => {
    const { host, editor } = await render(); selectTableCell(editor); await openToolbar(host);
    const target = action(host, 'Split merged cell'), before = editor.getJSON();
    expect(target.getAttribute('aria-disabled')).toBe('true'); await moveMouse(target);
    expect(document.activeElement).toBe(target);
    target.click(); await tick(); expect(editor.getJSON()).toEqual(before);
    expect(host.querySelector('[role="menu"]')).toBeTruthy(); expect(document.activeElement).toBe(target);
  });

  it('moves focus among the reusable More menu actions', async () => {
    const { editor } = await render(); selectTableCell(editor);
    const host = document.createElement('div'); document.body.append(host);
    const instance = mount(TableMenu, { target: host, props: { editor, more: true } });
    cleanups.push(async () => { await unmount(instance); host.remove(); }); await tick();
    host.querySelector<HTMLButtonElement>('[aria-label="More table actions"]')!.click(); await tick();
    expect(document.activeElement).toBe(action(host, 'Select row'));
    const target = action(host, 'Delete column'); await moveMouse(target);
    expect(document.activeElement).toBe(target); expect(target.tabIndex).toBe(0);
  });

  it('focuses the insertion item when mouse movement follows focus on its menu surface', async () => {
    const { host } = await render(); await openToolbar(host);
    const menu = host.querySelector<HTMLElement>('[role="menu"]')!, target = action(host, 'Insert table');
    expect(document.activeElement).toBe(target); menu.focus(); expect(document.activeElement).toBe(menu);
    await moveMouse(target); expect(document.activeElement).toBe(target);
  });
});
