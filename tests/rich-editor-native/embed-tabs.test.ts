// Supplemental actual Native tab transport regressions for the whole pinned
// EmbedBlockCard activateOnFocus/roving keyboard contract. No Source test edits.
import { afterEach, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { renderInDraftForm } from '../helpers/rich-editor/native-authoring-dom';
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const release of cleanup.splice(0)) await release(); });
async function saved() {
  const result = await renderInDraftForm({ value: [{ _type: 'iframe', _key: 'saved', src: 'https://example.com/map' }] });
  cleanup.push(result.cleanup);
  const tab = (name: string) => [...result.host.querySelectorAll<HTMLButtonElement>('[data-type="iframeBlock"] [role="tab"]')].find(button => button.textContent === name)!;
  return { ...result, tab };
}
it('activates iframe tabs on actual focus and mounts the corresponding real panel', async () => {
  const { host, tab } = await saved(); expect(tab('Preview').getAttribute('aria-selected')).toBe('true');
  tab('Code').focus(); await tick(); expect(tab('Code').getAttribute('aria-selected')).toBe('true');
  await vi.waitFor(() => expect(host.querySelector('.cm-content')).toBeTruthy());
  tab('Preview').focus(); await tick(); expect(tab('Preview').getAttribute('aria-selected')).toBe('true');
  expect(host.querySelector('.cm-content')).toBeNull();
});
it('uses roving tab focus with arrows, RTL direction and Home/End while retaining form locality', async () => {
  const { host, tab, submitted } = await saved(); tab('Preview').focus(); await tick();
  const press = async (key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(event); await tick(); expect(event.defaultPrevented).toBe(true);
  };
  await press('ArrowLeft'); expect(document.activeElement).toBe(tab('Code'));
  expect(tab('Code').tabIndex).toBe(0); expect(tab('Preview').tabIndex).toBe(-1);
  await press('End'); expect(document.activeElement).toBe(tab('Preview'));
  await press('Home'); expect(document.activeElement).toBe(tab('Code'));
  host.querySelector<HTMLElement>('[role="tablist"]')!.style.direction = 'rtl';
  await press('ArrowLeft'); expect(document.activeElement).toBe(tab('Preview'));
  await press('ArrowRight'); expect(document.activeElement).toBe(tab('Code')); expect(submitted).not.toHaveBeenCalled();
});
