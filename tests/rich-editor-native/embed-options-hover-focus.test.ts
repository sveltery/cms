// HTML115-OPTIONS-HOVER-FOCUS-01: actual pinned Kumo default menu behavior.
// Mounted production Svelte options; no focus, geometry, IO or dialog overrides.
import { afterEach, expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import EmbedBlockOptions from '../../src/lib/editor/rich-text/EmbedBlockOptions.svelte';
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const fn of cleanup.splice(0)) await fn(); });
async function openOptions() {
  const target = document.createElement('div'); document.body.append(target);
  const instance = mount(EmbedBlockOptions, { target, props: {
    label: 'HTML block options', translate: descriptor => typeof descriptor === 'string' ? descriptor : descriptor.message ?? descriptor.id,
    direction: 'ltr', isolated: true, onModeChange: () => {}, onDelete: () => {}
  } });
  cleanup.push(async () => { await unmount(instance); target.remove(); });
  await tick();
  target.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await tick(); await tick();
  const rows = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"], [role="menuitem"]')];
  expect(rows).toHaveLength(3);
  expect(document.activeElement).toBe(rows[0]);
  return rows;
}
it('moves real menu focus from Isolated frame to the hovered Inline radio row', async () => {
  const rows = await openOptions();
  rows[1].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
  await tick();
  expect(document.activeElement).toBe(rows[1]);
});
it('moves real menu focus to the hovered Delete action row', async () => {
  const rows = await openOptions();
  rows[2].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
  await tick();
  expect(document.activeElement).toBe(rows[2]);
});
