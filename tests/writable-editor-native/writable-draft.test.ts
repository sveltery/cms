import { afterEach, expect, it } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import WritableDraft from '../../src/lib/editor/WritableDraft.svelte';

// Original Svelte form assertions. These are additional to whole Source tests.
const instances: ReturnType<typeof mount>[] = [];
afterEach(async () => { for (const instance of instances.splice(0)) await unmount(instance); document.body.replaceChildren(); });
const fields = [
  { id: 'title', slug: 'title', label: 'Title', type: 'string' as const, required: true, validation: { pattern: 'cat' } },
  { id: 'body', slug: 'body', label: 'Body', type: 'text' as const, required: false, validation: null }
];
async function render(props: Record<string, unknown> = {}) {
  const target = document.createElement('form'); document.body.append(target);
  instances.push(flushSync(() => mount(WritableDraft, { target, props: { fields, values: { title: 'Initial', body: 'Original' }, canWrite: true, ...props } })));
  await tick(); return target;
}
it('trusted writable scalar fields are enabled and retain the JavaScript regex validation seam', async () => {
  const target = await render();
  expect(target.querySelector<HTMLInputElement>('input[data-field=title]')!.matches(':disabled')).toBe(false);
  expect(target.querySelector('input[data-field=title]')!.hasAttribute('pattern')).toBe(false);
  expect(target.querySelector<HTMLTextAreaElement>('textarea')!.matches(':disabled')).toBe(false);
});
it('the form submits actual edited values as bounded whole-record JSON', async () => {
  const target = await render({ values: { title: 'Initial', body: 'Original', untouched: { nested: ['kept'] } } });
  const input = target.querySelector<HTMLInputElement>('input[data-field=title]')!;
  input.value = 'Edited'; input.dispatchEvent(new Event('input', { bubbles: true })); await tick();
  expect(JSON.parse(String(new FormData(target).get('data')))).toEqual({ title: 'Edited', body: 'Original', untouched: { nested: ['kept'] } });
});
it('pending writes disable submission and announce saving', async () => {
  const target = await render({ pending: true });
  expect(target.querySelector('button')!.matches(':disabled')).toBe(true);
  expect(target.textContent).toContain('Saving...');
});
it('a rejected save shows issues while keeping the entered values readable', async () => {
  const target = await render({ values: { title: 'Rejected title', body: 'Keep this' }, issues: ['Title is required.'] });
  expect(target.querySelector('[role=alert]')?.textContent).toContain('Title is required.');
  expect(target.querySelector<HTMLInputElement>('input[data-field=title]')!.value).toBe('Rejected title');
});
it('read-only capabilities retain disabled controls and no mutation payload', async () => {
  const target = await render({ canWrite: false });
  expect(target.querySelector('button')!.matches(':disabled')).toBe(true);
  expect(new FormData(target).get('data')).toBeNull();
});
