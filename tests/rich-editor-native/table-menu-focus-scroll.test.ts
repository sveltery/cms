// Supplemental Native call observations of pinned Kumo2.6 list navigation
// (vendor3493–3512/3616–3628). Spies retain the actual per-element methods;
// these callbacks establish focus/call behavior, not browser layout parity.
import { afterEach, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { CellSelection } from '@tiptap/pm/tables';
import { renderInDraftForm } from '../helpers/rich-editor/native-authoring-dom';

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => { vi.restoreAllMocks(); await cleanup?.(); cleanup = undefined; });
async function openTableMenu() {
  const result = await renderInDraftForm(); cleanup = result.cleanup;
  result.editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
  let cell = -1;
  result.editor.state.doc.descendants((node, position) => { if (cell < 0 && node.type.name === 'tableCell') cell = position; });
  result.editor.view.dispatch(result.editor.state.tr.setSelection(CellSelection.create(result.editor.state.doc, cell)));
  await tick(); result.host.querySelector<HTMLButtonElement>('[data-emdash-table-trigger]')!.click(); await tick();
  return result;
}
function action(host: HTMLElement, label: string) {
  return [...host.querySelectorAll<HTMLButtonElement>('[role="menu"] button')].find(button => button.textContent?.trim() === label)!;
}
async function hover(target: HTMLButtonElement) {
  target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })); await tick();
}

it('moves pointer focus without requesting scroll', async () => {
  const { host } = await openTableMenu(), target = action(host, 'Delete row');
  const focus = vi.spyOn(target, 'focus'), scroll = vi.spyOn(target, 'scrollIntoView');
  await hover(target);
  expect(document.activeElement).toBe(target); expect(target.tabIndex).toBe(0);
  expect(action(host, 'Select row').tabIndex).toBe(-1);
  expect({ focusOptions: focus.mock.calls.at(-1)?.[0], scrollRequests: scroll.mock.calls.length })
    .toEqual({ focusOptions: { preventScroll: true }, scrollRequests: 0 });
});

it('keeps an unavailable pointer item focusable without scrolling or activating it', async () => {
  const { host, editor } = await openTableMenu(), target = action(host, 'Split merged cell'), before = editor.getJSON();
  const focus = vi.spyOn(target, 'focus'), scroll = vi.spyOn(target, 'scrollIntoView');
  expect(target.getAttribute('aria-disabled')).toBe('true'); await hover(target);
  expect(document.activeElement).toBe(target); target.click(); await tick();
  expect(editor.getJSON()).toEqual(before); expect(host.querySelector('[role="menu"]')).toBeTruthy();
  expect({ focusOptions: focus.mock.calls.at(-1)?.[0], scrollRequests: scroll.mock.calls.length })
    .toEqual({ focusOptions: { preventScroll: true }, scrollRequests: 0 });
});

it('reveals the actual keyboard destination after pointer navigation', async () => {
  const { host } = await openTableMenu(), pointerTarget = action(host, 'Delete row'), destination = action(host, 'Add column before');
  await hover(pointerTarget);
  const focus = vi.spyOn(destination, 'focus'), scroll = vi.spyOn(destination, 'scrollIntoView');
  pointerTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); await tick();
  expect(document.activeElement).toBe(destination); expect(destination.tabIndex).toBe(0); expect(pointerTarget.tabIndex).toBe(-1);
  expect(focus.mock.calls.at(-1)?.[0]).toEqual({ preventScroll: true });
  expect(scroll.mock.calls).toEqual([[{ block: 'nearest', inline: 'nearest' }]]);
});
