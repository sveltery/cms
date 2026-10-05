// Actual Native DOM boundary regressions reached by unchanged Source HTML258
// and iframe180. One Source node wrapper per Portable Text block, no mock cards.
import { afterEach, describe, expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import type { Editor } from '@tiptap/core';
import PortableTextEditor from '../../src/lib/editor/rich-text/PortableTextEditor.svelte';
import type { AuthoringBlock } from '../../src/lib/editor/rich-text/types';
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const fn of cleanup.splice(0)) await fn(); });
async function host(value: AuthoringBlock[]) {
  const target = document.createElement('div'); document.body.append(target);
  let editor: Editor | null = null;
  const instance = mount(PortableTextEditor, { target, props: { value, onEditorReady: current => { editor = current; } } });
  cleanup.push(async () => { await unmount(instance); target.remove(); });
  await tick(); expect(editor).toBeTruthy(); return target;
}
describe('Source embed node boundary ownership', () => {
  it('inserts isolated HTML from the real Source toolbar action', async () => {
    const target = await host([{ _type: 'block', _key: 'text', style: 'normal', children: [{ _type: 'span', _key: 'span', text: 'Text' }] }]);
    const button = target.querySelector<HTMLButtonElement>('button[aria-label="Insert HTML"]');
    expect(button).not.toBeNull();
    button!.click(); await tick();
    expect(target.querySelectorAll('[data-type="htmlBlock"]')).toHaveLength(1);
  });
  it('counts two saved HTML blocks as two Source wrappers', async () => {
    const target = await host([
      { _type: 'htmlBlock', _key: 'one', html: '<p>One</p>' },
      { _type: 'htmlBlock', _key: 'two', html: '<p>Two</p>' }
    ]);
    expect(target.querySelectorAll('.html-block')).toHaveLength(2);
  });
  it('counts two saved iframe blocks as two Source wrappers', async () => {
    const target = await host([
      { _type: 'iframe', _key: 'one', src: 'https://example.com/one' },
      { _type: 'iframe', _key: 'two', src: 'https://example.com/two' }
    ]);
    expect(target.querySelectorAll('.iframe-block')).toHaveLength(2);
  });
});
