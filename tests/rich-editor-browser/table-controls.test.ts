// Separate Native browser requirements from pinned PortableTextEditor.tsx
//4369–4448 and whole portable-text-table.spec.ts contextual controls. No auth or
// protected HTTP fixture is used. Every geometry/focus reading is real Chromium.
import { afterEach, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { mount, tick, unmount } from 'svelte';
import { CellSelection } from '@tiptap/pm/tables';
import type { Editor } from '@tiptap/core';
import PortableTextEditor from '../../src/lib/editor/rich-text/PortableTextEditor.svelte';
import { bridgeState } from '../helpers/rich-editor/state.svelte';
import type { PortableTextEditorProps } from '../../src/lib/editor/rich-text/types';
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function render(direction: 'ltr' | 'rtl' = 'ltr') {
  const host = document.createElement('div'); host.dir = direction; document.body.append(host);
  let current: Editor | null = null;
  const props = bridgeState<PortableTextEditorProps>({ editable: true, onChange: vi.fn(), onEditorReady: editor => { current = editor; },
    value: [{ _type: 'table', _key: 'table', rows: [0, 1, 2].map(row => ({ _type: 'tableRow', _key: `row${row}`,
      cells: [0, 1, 2].map(column => ({ _type: 'tableCell', _key: `cell${row}-${column}`, content: [{ _type: 'span', _key: `text${row}-${column}`, text: `${row}:${column}` }] })) })) }] });
  const instance = mount(PortableTextEditor, { target: host, props }); cleanups.push(async () => { await unmount(instance); host.remove(); });
  await tick(); await vi.waitFor(() => expect(current).toBeTruthy()); const editor = current! as Editor;
  const positions: number[] = []; editor.state.doc.descendants((node, position) => { if (node.type.name === 'tableCell') positions.push(position); });
  editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, positions[0]))); editor.view.focus();
  return { host, editor, props, positions };
}
function visible(element: HTMLElement) { return getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 0; }

it.each(['ltr', 'rtl'] as const)('keeps contextual header controls anchored while toggling in %s', async direction => {
  const { host, editor } = await render(direction);
  const bubble = () => host.querySelector<HTMLElement>('[data-emdash-table-bubble-menu]');
  await vi.waitFor(() => expect(bubble()).toBeTruthy()); await vi.waitFor(() => expect(visible(bubble()!)).toBe(true));
  const more = bubble()!.querySelector<HTMLButtonElement>('[aria-label="More table actions"]')!; await userEvent.click(more);
  const menu = host.querySelector<HTMLElement>('[role="menu"][aria-label="Table actions"]')!;
  expect(menu).toBeTruthy();
  for (const index of [0, 1, 0, 1]) {
    const checkbox = menu.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]')[index]; checkbox.scrollIntoView({ block: 'nearest' });
    const before = menu.getBoundingClientRect(), scroll = menu.scrollTop, checked = checkbox.getAttribute('aria-checked');
    await userEvent.click(checkbox);
    await vi.waitFor(() => expect(checkbox.getAttribute('aria-checked')).toBe(checked === 'true' ? 'false' : 'true'));
    expect(host.querySelector('[role="menu"]')).toBe(menu); expect(visible(more)).toBe(true);
    const after = menu.getBoundingClientRect(); expect(after.x).toBeCloseTo(before.x, 0); expect(after.y).toBeCloseTo(before.y, 0); expect(menu.scrollTop).toBe(scroll);
    await userEvent.keyboard('{End}'); const last = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].at(-1)!;
    expect(document.activeElement).toBe(last); const bounds = last.getBoundingClientRect();
    expect(last.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2))).toBe(true);
  }
  await userEvent.keyboard('{Escape}'); await vi.waitFor(() => expect(host.querySelector('[role="menu"]')).toBeNull()); expect(editor.view.hasFocus()).toBe(true);
});

it('uses real trigger keyboard navigation and leaves outside focus undisturbed', async () => {
  const { host, editor } = await render();
  const trigger = host.querySelector<HTMLButtonElement>('[data-emdash-table-trigger]')!;
  editor.view.focus(); await userEvent.keyboard('{Alt>}{F10}{/Alt}'); expect(document.activeElement).toBe(trigger);
  await userEvent.keyboard('{ArrowDown}'); const menu = host.querySelector<HTMLElement>('[role="menu"]');
  await vi.waitFor(() => expect(menu).toBeTruthy()); expect(document.activeElement?.textContent?.trim()).toBe('Select row');
  await userEvent.keyboard('d'); expect(document.activeElement?.textContent?.trim()).toBe('Delete row');
  const outside = document.createElement('input'); document.body.append(outside); cleanups.push(async () => outside.remove());
  await userEvent.click(outside); expect(document.activeElement).toBe(outside); await vi.waitFor(() => expect(host.querySelector('[role="menu"]')).toBeNull());
});

it('closes an actual open bubble menu and hides table controls on read-only transition', async () => {
  const { host, props } = await render();
  const more = () => host.querySelector<HTMLButtonElement>('[data-emdash-table-bubble-menu] [aria-label="More table actions"]');
  await vi.waitFor(() => expect(more()).toBeTruthy()); await vi.waitFor(() => expect(visible(more()!)).toBe(true)); await userEvent.click(more()!);
  expect(host.querySelector('[role="menu"]')).toBeTruthy(); props.editable = false; await tick();
  await vi.waitFor(() => expect(host.querySelector('[role="menu"]')).toBeNull()); expect(host.querySelector('[data-emdash-table-trigger]')).toBeNull();
  const bubble = host.querySelector<HTMLElement>('[data-emdash-table-bubble-menu]'); if (bubble) expect(visible(bubble)).toBe(false);
});
