// Actual Native regression for configured comment4181118940. Original Source
// families and all previous47 Native callback bodies/data/clocks are unchanged.
import { afterEach, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { CellSelection } from '@tiptap/pm/tables';
import type { Editor } from '@tiptap/core';
import PortableTextEditor from '../../src/lib/editor/rich-text/PortableTextEditor.svelte';
import type { PortableTextEditorProps } from '../../src/lib/editor/rich-text/types';
import { bridgeState } from '../helpers/rich-editor/state.svelte';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const release of cleanup.splice(0)) await release(); });
it('closes an open table action menu on actual read-only props and restores editing without hidden mutations', async () => {
  const host = document.createElement('div'); document.body.append(host);
  let editor: Editor | null = null; const onChange = vi.fn();
  const props = bridgeState<PortableTextEditorProps>({ editable: true, onChange,
    onEditorReady: current => { editor = current; }, value: [{ _type: 'table', _key: 'table', rows: [
      { _type: 'tableRow', _key: 'row', cells: [{ _type: 'tableCell', _key: 'cell', content: [{ _type: 'span', _key: 'text', text: 'Cell' }] }] }
    ] }] });
  const instance = mount(PortableTextEditor, { target: host, props });
  cleanup.push(async () => { await unmount(instance); host.remove(); });
  await tick(); expect(editor).toBeTruthy(); const current = editor! as Editor;
  // Genuine ProseMirror scroll hook suppresses only unavailable jsdom Range
  // presentation, matching the existing Native host; no geometry is supplied.
  current.setOptions({ editorProps: { ...current.options.editorProps, handleScrollToSelection: () => true } });
  let cell = -1; current.state.doc.descendants((node, position) => { if (node.type.name === 'tableCell') cell = position; });
  current.view.dispatch(current.state.tr.setSelection(CellSelection.create(current.state.doc, cell))); await tick();
  const trigger = () => host.querySelector<HTMLButtonElement>('button[aria-label="Table"]')!;
  const menu = () => host.querySelector('[aria-label="Table actions"]');
  const action = () => [...host.querySelectorAll<HTMLButtonElement>('[aria-label="Table actions"] button')].find(button => button.textContent === 'Add row below')!;
  trigger().click(); await tick(); expect(action().disabled).toBe(false);
  const before = current.getJSON(); onChange.mockClear();
  props.editable = false; await tick();
  expect(current.isEditable).toBe(false); expect(menu()).toBeNull(); expect(trigger().disabled).toBe(true);
  expect(current.getJSON()).toEqual(before); expect(onChange).not.toHaveBeenCalled();
  props.editable = true; await tick(); expect(current.isEditable).toBe(true); expect(menu()).toBeNull();
  trigger().click(); await tick(); expect(action().disabled).toBe(false); action().click(); await tick();
  expect(current.state.doc.firstChild!.childCount).toBe(2); expect(onChange).toHaveBeenCalledTimes(1);
});
