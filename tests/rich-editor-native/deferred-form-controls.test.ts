// Supplemental regressions for configured review5409290162. Original Source
// test bodies and clocks are unchanged; only Native integration credit applies.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { command, ordinarySlash, paragraph, renderInDraftForm, texts } from '../helpers/rich-editor/native-authoring-dom';

const api = vi.hoisted(() => ({ fetchSections: vi.fn() }));
vi.mock('../../src/lib/sections-widgets/api.ts', () => api);
const cleanups: (() => Promise<void>)[] = [];
beforeEach(() => {
  api.fetchSections.mockResolvedValue({ items: [{ id: 'section', slug: 'section', title: 'Reusable section',
    keywords: [], source: 'user', content: [paragraph('inserted', 'Inserted section')], createdAt: '', updatedAt: '' }] });
  // jsdom lacks native dialog presentation. This changes only the open attribute,
  // with no focus/keyboard/a11y/browser fidelity claim or fabricated coordinates.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
});
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function render() { const result = await renderInDraftForm(); cleanups.push(result.cleanup); return result; }
async function picker(host: HTMLElement) { await vi.waitFor(() => expect(host.querySelector('dialog .panel')).toBeTruthy()); }

describe('Editor-local operations inside a real enclosing draft form', () => {
  it.each(['Close', 'Cancel', 'Reusable section'])('keeps section picker %s local while the actual draft Save remains a submit control', async label => {
    const { host, gutter, editor, submitted, save } = await render();
    gutter(0); await tick(); await command(host, 'Section'); await picker(host);
    const button = [...host.querySelectorAll<HTMLButtonElement>('dialog button')]
      .find(button => button.getAttribute('aria-label') === label || button.textContent?.trim() === label)!;
    button.click(); await tick(); expect(host.querySelector('dialog')).toBeNull();
    if (label === 'Reusable section') expect(texts(editor)).toEqual(['Inserted section', 'First', 'Last']);
    else expect(texts(editor)).toEqual(['First', 'Last']);
    expect(submitted).not.toHaveBeenCalled(); save.click(); expect(submitted).toHaveBeenCalledTimes(1);
  });

  it('applies a real selected-text link by clicking Apply without submitting the surrounding draft', async () => {
    const { host, editor, submitted } = await render(); editor.commands.setTextSelection({ from: 1, to: 6 });
    host.querySelector<HTMLButtonElement>('button[aria-label="Insert Link"]')!.click(); await tick();
    const input = host.querySelector<HTMLInputElement>('input[placeholder="https://"]')!;
    input.value = 'https://example.com/selected'; input.dispatchEvent(new Event('input', { bubbles: true })); await tick();
    [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Apply')!.click(); await tick();
    expect(editor.getJSON().content?.[0].content?.[0].marks).toContainEqual(expect.objectContaining({ type: 'link', attrs: expect.objectContaining({ href: 'https://example.com/selected' }) }));
    expect(submitted).not.toHaveBeenCalled();
  });

  it('applies a selected-text link with Enter while cancelling the draft implicit-submit default', async () => {
    const { host, editor, submitted } = await render(); editor.commands.setTextSelection({ from: 1, to: 6 });
    host.querySelector<HTMLButtonElement>('button[aria-label="Insert Link"]')!.click(); await tick();
    const input = host.querySelector<HTMLInputElement>('input[placeholder="https://"]')!;
    input.value = 'https://example.com/keyboard'; input.dispatchEvent(new Event('input', { bubbles: true })); await tick();
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }); input.dispatchEvent(event); await tick();
    expect(event.defaultPrevented).toBe(true);
    expect(editor.getJSON().content?.[0].content?.[0].marks).toContainEqual(expect.objectContaining({ type: 'link', attrs: expect.objectContaining({ href: 'https://example.com/keyboard' }) }));
    expect(submitted).not.toHaveBeenCalled();
  });

  it('forgets a cancelled gutter section position before a later ordinary slash selection', async () => {
    const { host, gutter, editor } = await render(); gutter(0); await tick(); await command(host, 'Section'); await picker(host);
    [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(button => button.textContent === 'Cancel')!.click(); await tick();
    await ordinarySlash(host, editor, 'Section'); await picker(host); host.querySelector<HTMLButtonElement>('dialog .panel')!.click(); await tick();
    expect(texts(editor)).toEqual(['First', 'Last', 'Inserted section']);
  });

  it.each(['Image', 'Gallery'])('forgets the unavailable gutter %s position before an ordinary HTML slash insertion', async title => {
    const { host, gutter, editor } = await render(); gutter(0); await tick(); await command(host, title);
    expect(host.textContent).toContain('Media can be inserted when the media library is available.');
    await ordinarySlash(host, editor, 'HTML');
    expect(texts(editor)).toEqual(['First', 'Last', 'htmlBlock', 'paragraph']);
  });
});
