// Supplemental Native DOM host: real editor, real enclosing form, actual submit
// events. No remote, session, authorization or persistence transport is supplied.
import { expect, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import type { Editor } from '@tiptap/core';
import PortableTextEditor from '../../../src/lib/editor/rich-text/PortableTextEditor.svelte';
import type { AuthoringBlock, PortableTextEditorProps } from '../../../src/lib/editor/rich-text/types';

export const paragraph = (key: string, text: string): AuthoringBlock => ({
  _type: 'block', _key: key, style: 'normal', children: [{ _type: 'span', _key: `${key}-text`, text }]
});
export async function renderInDraftForm(extra: Partial<PortableTextEditorProps> = {}) {
  // jsdom also lacks element scroll presentation; this is not browser geometry.
  if (!HTMLElement.prototype.scrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value() {} });
  const form = document.createElement('form'); form.setAttribute('aria-label', 'Draft host');
  const host = document.createElement('div'); form.append(host); document.body.append(form);
  const submitted = vi.fn((event: Event) => event.preventDefault()); form.addEventListener('submit', submitted);
  const save = document.createElement('button'); save.type = 'submit'; save.textContent = 'Save draft'; form.append(save);
  const onChange = vi.fn(); let editor: Editor | null = null; let gutter: ((position: number) => void) | undefined;
  const instance = mount(PortableTextEditor, { target: host, props: {
    value: [paragraph('first', 'First'), paragraph('last', 'Last')], onChange,
    onEditorReady: value => { editor = value; }, onGutterReady: value => { gutter = value; }, ...extra
  } });
  await tick(); expect(editor).toBeTruthy(); expect(gutter).toBeTypeOf('function');
  // jsdom has no Range layout. Suppress only scroll presentation via the actual
  // ProseMirror hook, as the existing Native authoring regressions already do.
  editor!.setOptions({ editorProps: { ...editor!.options.editorProps, handleScrollToSelection: () => true } });
  return { form, host, save, submitted, editor: editor!, onChange,
    gutter: (position: number) => gutter!(position),
    cleanup: async () => { await unmount(instance); form.remove(); }
  };
}
export async function command(host: HTMLElement, title: string) {
  await vi.waitFor(() => expect(host.querySelector('[data-slash-command-menu]')).toBeTruthy());
  const button = [...host.querySelectorAll<HTMLButtonElement>('[data-slash-command-menu] button')]
    .find(button => button.querySelector('.font-medium')?.textContent === title)!;
  expect(button).toBeTruthy(); button.click(); await tick();
}
export async function ordinarySlash(host: HTMLElement, editor: Editor, title: string) {
  editor.commands.insertContentAt(editor.state.doc.content.size, { type: 'paragraph' });
  editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  editor.commands.insertContent('/'); await tick(); await command(host, title);
}
export function texts(editor: Editor) { return editor.getJSON().content?.map(node => node.content?.map(span => span.text ?? '').join('') ?? node.type); }
