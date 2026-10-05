// Supplemental regressions for RFEFINAL01/02. These mount the actual Native
// Svelte/Tiptap editor and its real controls; no Source assertion is replaced.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import type { Editor } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import PortableTextEditor from '../../src/lib/editor/rich-text/PortableTextEditor.svelte';
import type { AuthoringBlock } from '../../src/lib/editor/rich-text/types';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
function paragraph(key: string, text: string): AuthoringBlock {
  return { _type: 'block', _key: key, style: 'normal', children: [{ _type: 'span', _key: `${key}-span`, text }] };
}
function table(): AuthoringBlock {
  return { _type: 'table', _key: 'table', rows: [{ _type: 'tableRow', _key: 'row', cells: [
    { _type: 'tableCell', _key: 'left', content: [{ _type: 'span', _key: 'left-span', text: 'Left' }] },
    { _type: 'tableCell', _key: 'right', content: [{ _type: 'span', _key: 'right-span', text: 'Right' }] }
  ] }] };
}
async function render(value: AuthoringBlock[], extra: Partial<import('../../src/lib/editor/rich-text/types').PortableTextEditorProps> = {}) {
  const host = document.createElement('div'); document.body.append(host);
  const onChange = vi.fn();
  let editor: Editor | null = null;
  const instance = mount(PortableTextEditor, { target: host, props: { value, onChange,
    onEditorReady: current => { editor = current; }, ...extra } });
  cleanups.push(async () => { await unmount(instance); host.remove(); });
  await tick(); expect(editor).toBeTruthy();
  // jsdom has no layout or Range.getClientRects. These are persisted-data and
  // control regressions; suppress only the browser's scroll presentation via
  // the real ProseMirror hook, without fabricating geometry or changing data.
  editor!.setOptions({ editorProps: { ...editor!.options.editorProps, handleScrollToSelection: () => true } });
  return { host, editor: editor!, onChange };
}
function positions(editor: Editor, name: string): number[] {
  const result: number[] = [];
  editor.state.doc.descendants((node, position) => { if (node.type.name === name) result.push(position); });
  return result;
}
function alignmentButton(host: HTMLElement, alignment: string): HTMLButtonElement {
  return host.querySelector<HTMLButtonElement>(`button[aria-label="Align ${alignment}"]`)!;
}

describe('Actual Native authoring control fidelity repairs', () => {
  it('persists text-cell alignment in the emitted Portable Text cell, without paragraph-only alignment', async () => {
    const { host, editor, onChange } = await render([table()]);
    const [cell] = positions(editor, 'tableCell');
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, cell + 2)));
    onChange.mockClear(); alignmentButton(host, 'Center').click(); await tick();
    expect(editor.state.doc.nodeAt(cell)!.attrs.textAlign).toBe('center');
    expect(onChange.mock.lastCall?.[0][0].rows[0].cells[0].textAlign).toBe('center');
    expect(editor.state.doc.nodeAt(cell)!.firstChild!.attrs.textAlign).toBeNull();
  });

  it('persists alignment across the actual CellSelection and emits both selected cell attributes', async () => {
    const { host, editor, onChange } = await render([table()]);
    const [first, second] = positions(editor, 'tableCell');
    editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, first, second)));
    onChange.mockClear(); alignmentButton(host, 'Right').click(); await tick();
    expect([first, second].map(position => editor.state.doc.nodeAt(position)!.attrs.textAlign)).toEqual(['right', 'right']);
    expect(onChange.mock.lastCall?.[0][0].rows[0].cells.map((cell: { textAlign?: string }) => cell.textAlign)).toEqual(['right', 'right']);
  });

  it('refuses toolbar alignment for an actual mixed table and outside-text selection', async () => {
    const { host, editor, onChange } = await render([table(), paragraph('outside', 'Keep outside text')]);
    const [cell] = positions(editor, 'tableCell');
    const paragraphs = positions(editor, 'paragraph'), outside = paragraphs.at(-1)!;
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, cell + 2, outside + 5)));
    await tick(); const before = editor.getJSON(); onChange.mockClear();
    expect(alignmentButton(host, 'Center').disabled).toBe(true);
    alignmentButton(host, 'Center').click(); await tick();
    expect(editor.getJSON()).toEqual(before); expect(onChange).not.toHaveBeenCalled();
  });

  it('deletes only the clicked HTML embed while unrelated paragraph text is selected', async () => {
    const { host, editor, onChange } = await render([paragraph('keep', 'Keep this text'),
      { _type: 'htmlBlock', _key: 'remove', html: '<p>Remove this embed</p>' }, paragraph('after', 'After')]);
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1, 5)));
    onChange.mockClear();
    host.querySelector<HTMLButtonElement>('[data-type="htmlBlock"] button[aria-label="HTML block options"]')!.click(); await tick();
    [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(button => button.textContent?.trim() === 'Delete block')!.click(); await tick();
    expect(editor.state.doc.content.content.map(node => node.type.name)).toEqual(['paragraph', 'paragraph']);
    expect(editor.getText()).toBe('Keep this text\n\nAfter');
    expect(onChange.mock.lastCall?.[0].map((block: AuthoringBlock) => block._key)).toEqual(['keep', 'after']);
  });

  it('deletes the clicked iframe at its current moved position while a different HTML node is selected', async () => {
    const { host, editor, onChange } = await render([
      { _type: 'htmlBlock', _key: 'keep-html', html: '<p>Keep HTML</p>' },
      { _type: 'iframe', _key: 'remove-iframe', src: 'https://example.com/embed', title: 'Remove iframe' }, paragraph('keep-text', 'Keep text')]);
    editor.commands.insertContentAt(0, { type: 'paragraph', content: [{ type: 'text', text: 'Inserted before' }] });
    const [otherNode] = positions(editor, 'htmlBlock');
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, otherNode)));
    onChange.mockClear();
    host.querySelector<HTMLButtonElement>('[data-type="iframeBlock"] button[aria-label="Iframe block options"]')!.click(); await tick();
    [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(button => button.textContent?.trim() === 'Delete block')!.click(); await tick();
    expect(positions(editor, 'iframeBlock')).toEqual([]); expect(positions(editor, 'htmlBlock')).toHaveLength(1);
    expect(editor.state.doc.nodeAt(positions(editor, 'htmlBlock')[0])!.attrs.html).toBe('<p>Keep HTML</p>');
    expect(editor.getText()).toContain('Inserted before'); expect(editor.getText()).toContain('Keep text');
    expect(onChange.mock.lastCall?.[0].some((block: AuthoringBlock) => block._key === 'keep-html')).toBe(true);
    expect(onChange.mock.lastCall?.[0].some((block: AuthoringBlock) => block._key === 'remove-iframe')).toBe(false);
  });

  it('mounts a payload-less registered plugin and retains a no-op value with the actual Native component', async () => {
    const value: AuthoringBlock[] = [{ _type: 'block', _key: 'block-1', style: 'normal',
      children: [{ _type: 'span', _key: 'span-1', text: 'Linked text', marks: ['link-1'] }],
      markDefs: [{ _type: 'link', _key: 'link-1', href: 'https://example.com' }] },
      { _type: 'test.divider', _key: 'divider-1' }];
    const { editor, onChange } = await render(value, { pluginBlocks: [{ type: 'test.divider', pluginId: 'test-blocks', label: 'Divider', fields: [] }] });
    const { prosemirrorToPortableText } = await import('../../src/lib/editor/portable-text/admin-converters');
    expect(prosemirrorToPortableText(editor.getJSON())).toEqual(value);
    onChange.mockClear(); editor.commands.setContent(editor.getJSON(), { emitUpdate: true }); await tick();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps a code language popup usable after cancellation and commits keyboard suggestions without cleanup errors', async () => {
    const { host, editor } = await render([{ _type: 'code', _key: 'code', code: 'custom()', language: 'custom-language' }]);
    const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="Set language (current: custom-language)"]')!;
    trigger.click(); await tick();
    let search = document.querySelector<HTMLInputElement>('input[role="combobox"][placeholder="Search for a language…"]')!;
    search.value = 'Discarded Language'; search.dispatchEvent(new Event('input', { bubbles: true })); await tick();
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await tick();
    expect(document.querySelector('.emdash-code-language-popover')).toBeNull();
    expect(editor.getJSON().content?.[0].attrs?.language).toBe('custom-language');
    trigger.click(); await tick();
    search = document.querySelector<HTMLInputElement>('input[role="combobox"][placeholder="Search for a language…"]')!;
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); await tick();
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await tick();
    expect(editor.getJSON().content?.[0].attrs?.language).toBe('astro');
    expect(document.querySelector('.emdash-code-language-popover')).toBeNull();
  });
});
