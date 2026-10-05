// Supplemental Native browser acceptance. All original Source families stay whole.
// The real Playwright keyboard performs the browser's implicit-submit default.
import { afterEach, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { mount, tick, unmount } from 'svelte';
import PortableTextEditor from '../../src/lib/editor/rich-text/PortableTextEditor.svelte';
import type { AuthoringBlock } from '../../src/lib/editor/rich-text/types';

const api = vi.hoisted(() => ({ fetchSections: vi.fn() }));
vi.mock('../../src/lib/sections-widgets/api.ts', () => api);
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
const paragraph = (key: string, text: string): AuthoringBlock => ({
  _type: 'block', _key: key, style: 'normal', children: [{ _type: 'span', _key: `${key}-text`, text }]
});

it('keeps real browser search Enter local while the enclosing draft still submits explicitly', async () => {
  api.fetchSections.mockResolvedValue({ items: [{ id: 'section', slug: 'section', title: 'Reusable section',
    keywords: [], source: 'user', content: [paragraph('inserted', 'Inserted section')], createdAt: '', updatedAt: '' }] });
  const form = document.createElement('form');
  const host = document.createElement('div'); form.append(host); document.body.append(form);
  const submitted = vi.fn((event: Event) => event.preventDefault()); form.addEventListener('submit', submitted);
  const save = document.createElement('button'); save.type = 'submit'; save.textContent = 'Save draft'; form.append(save);
  const control = document.createElement('input'); control.setAttribute('aria-label', 'Implicit submit control'); form.prepend(control);
  // Positive control proves this keyboard driver executes actual browser defaults.
  await userEvent.fill(control, 'control'); await userEvent.keyboard('{Enter}');
  expect(submitted).toHaveBeenCalledTimes(1); control.remove(); submitted.mockClear();
  let gutter: ((position: number) => void) | undefined;
  const instance = mount(PortableTextEditor, { target: host, props: {
    value: [paragraph('first', 'First'), paragraph('last', 'Last')], onChange: vi.fn(),
    onGutterReady: value => { gutter = value; }
  } });
  cleanups.push(async () => { await unmount(instance); form.remove(); });
  await tick(); await vi.waitFor(() => expect(gutter).toBeTypeOf('function'));
  gutter!(0); await tick();
  await vi.waitFor(() => expect(host.querySelector('[data-slash-command-menu]')).toBeTruthy());
  const section = [...host.querySelectorAll<HTMLButtonElement>('[data-slash-command-menu] button')]
    .find(button => button.querySelector('.font-medium')?.textContent === 'Section')!;
  await userEvent.click(section);
  await vi.waitFor(() => expect(host.querySelector('dialog .panel')).toBeTruthy());
  const search = host.querySelector<HTMLInputElement>('input[aria-label="Search sections..."]')!;
  expect(search.form).toBe(form); expect(host.querySelector<HTMLDialogElement>('dialog')!.open).toBe(true);
  api.fetchSections.mockClear();
  await userEvent.fill(search, 'Reusable'); await userEvent.keyboard('{Enter}');
  await vi.waitFor(() => expect(api.fetchSections).toHaveBeenCalledWith({ search: 'Reusable' }));
  expect(submitted).not.toHaveBeenCalled(); expect(host.querySelector<HTMLDialogElement>('dialog')!.open).toBe(true);
  await userEvent.click(host.querySelector<HTMLButtonElement>('dialog button[aria-label="Close"]')!);
  await vi.waitFor(() => expect(host.querySelector('dialog')).toBeNull());
  await userEvent.click(save); expect(submitted).toHaveBeenCalledTimes(1);
});
