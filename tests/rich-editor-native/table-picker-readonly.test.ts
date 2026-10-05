// Supplemental actual Svelte lifecycle reproducer of original Source
// slash-menu.test.tsx507–522. The complete original213 CI569 report is retained
// separately; this Native callback has no browser geometry credit.
import { afterEach, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import type { Editor } from '@tiptap/core';
import Host from '../helpers/rich-editor/EditorHost.svelte';
import { bridgeState } from '../helpers/rich-editor/state.svelte';
import { command } from '../helpers/rich-editor/native-authoring-dom';
import type { PortableTextEditorProps } from '../../src/lib/editor/rich-text/types';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); vi.unstubAllGlobals(); });

it('closes the actual shared slash table picker on read-only props without an update loop or query mutation', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  // The same absence-only scroll transport as native-authoring-dom.ts. jsdom
  // supplies no scroll presentation; no rectangle/visibility is fabricated.
  if (!HTMLElement.prototype.scrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value() {} });
  const host = document.createElement('div'); document.body.append(host);
  let current: Editor | null = null; const onChange = vi.fn();
  const state = bridgeState<PortableTextEditorProps>({ editable: true, onChange, onEditorReady: editor => { current = editor; } });
  const instance = flushSync(() => mount(Host, { target: host, props: { state } }));
  cleanups.push(async () => { await unmount(instance); host.remove(); }); await tick();
  expect(current).toBeTruthy(); const editor = current! as Editor;
  editor.setOptions({ editorProps: { ...editor.options.editorProps, handleScrollToSelection: () => true } });
  editor.commands.insertContent('/table'); await tick(); await command(host, 'Table');
  expect(host.querySelector('[role="grid"][aria-label="Table size"]')).toBeTruthy();
  const before = editor.getJSON(); onChange.mockClear();
  flushSync(() => { state.editable = false; }); await tick();
  expect(editor.isEditable).toBe(false); expect(host.querySelector('[data-slash-command-menu]')).toBeNull();
  expect(host.querySelector('[role="grid"][aria-label="Table size"]')).toBeNull();
  expect(editor.getText()).toContain('/table'); expect(editor.getJSON()).toEqual(before);
});
