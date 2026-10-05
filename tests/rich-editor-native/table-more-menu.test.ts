// Supplemental actual Svelte TableMoreMenu scope. Missing production import is
// recorded as Native readiness, never an original Source value failure.
import { afterEach, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { CellSelection } from '@tiptap/pm/tables';
import { EmDashTable, EmDashTableCell, EmDashTableHeader, EmDashTableRow, TableIdentity } from '../../src/lib/editor/rich-text/TableExtensions';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const release of cleanup.splice(0)) await release(); });
it('provides the reusable More menu with actual selected-cell actions and result announcements', async () => {
  const module = await import('../../src/lib/editor/rich-text/TableMenu.svelte').catch(() => null);
  expect(module?.default).toBeTruthy();
  const host = document.createElement('div'), content = document.createElement('div'); document.body.append(host, content);
  const editor = new Editor({ element: content, extensions: [StarterKit, EmDashTable.configure({ resizable: false }), EmDashTableRow,
    EmDashTableHeader, EmDashTableCell, TableIdentity], content: { type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [
      { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell' }] }] }
    ] }] }, { type: 'paragraph' }] }, editorProps: { handleScrollToSelection: () => true } });
  let cell = -1; editor.state.doc.descendants((node, position) => { if (node.type.name === 'tableCell') cell = position; });
  editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cell)));
  const onRun = vi.fn(); const instance = mount(module!.default, { target: host, props: { editor, more: true, onRun } });
  cleanup.push(async () => { await unmount(instance); editor.destroy(); host.remove(); content.remove(); }); await tick();
  const trigger = host.querySelector<HTMLButtonElement>('[aria-label="More table actions"]')!;
  expect(trigger).toBeTruthy(); expect(trigger.hasAttribute('aria-keyshortcuts')).toBe(false);
  trigger.click(); await tick();
  expect(host.querySelector('[role="menu"]')!.textContent).not.toContain('Insert table');
  const add = [...host.querySelectorAll<HTMLButtonElement>('[role="menu"] button')].find(button => button.textContent?.trim() === 'Add row below')!;
  add.click(); await tick(); expect(editor.state.doc.firstChild!.childCount).toBe(2); expect(onRun).toHaveBeenCalledExactlyOnceWith('Row added below');
  expect(host.querySelector('[role="menu"]')).toBeNull(); expect(editor.view.hasFocus()).toBe(true);
});
