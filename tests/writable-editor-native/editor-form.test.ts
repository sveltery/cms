import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes';
import { useFixture } from '../helpers/writable-editor-dom/remotes';
import { app } from '../helpers/writable-editor-dom/framework';
import EditorForm from '../../src/lib/editor/EditorForm.svelte';

// Original complete owned-form transport regressions. The installed Kit form,
// binary serialization/parser, built HTTP remotes, fixed stored author and
// persisted Node SQLite are real. No successful response/backend is stubbed.
let fixture: Awaited<ReturnType<typeof schemaAdminRemotes>>;
let instance: ReturnType<typeof mount> | undefined;
const actualFetch = globalThis.fetch;
let delay: Promise<void> | undefined;
let release: (() => void) | undefined;
let requestCount = 0;
beforeEach(async () => {
  fixture = await schemaAdminRemotes('Node'); useFixture(fixture); app.decoders = fixture.decoders;
  await fixture.registry.createCollection({ slug: 'stories', label: 'Stories', supports: ['drafts', 'revisions'] });
  await fixture.registry.createField('stories', { slug: 'title', label: 'Title', type: 'string', required: true });
  await fixture.registry.createField('stories', { slug: 'summary', label: 'Summary', type: 'string', validation: { minLength: 10 } });
  delay = undefined; release = undefined; requestCount = 0;
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    if (typeof input !== 'string' || !input.startsWith('/_app/remote/')) return actualFetch(input, init);
    requestCount++; if (delay) await delay;
    const body = init?.body instanceof Blob ? await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error); reader.readAsArrayBuffer(init.body as Blob);
    }) : init?.body;
    return actualFetch(new URL(input, fixture.origin), { ...init, body,
      headers: { ...init?.headers, origin: fixture.origin, cookie: `cms-session=${fixture.tokens.author}` } });
  });
});
afterEach(async () => {
  release?.(); if (instance) await unmount(instance); instance = undefined;
  document.body.replaceChildren(); vi.useRealTimers(); vi.unstubAllGlobals(); await fixture?.close();
});
async function render() {
  const result = await fixture.mutate('createContent', { collection: 'stories', data: JSON.stringify({ title: 'Original' }) }, 'author');
  const entry = await fixture.query('getContent', { collection: 'stories', id: result._.result.id }, 'author');
  const manifest = await fixture.query('getEditorManifest', undefined, 'author');
  const target = document.createElement('div'); document.body.append(target);
  instance = flushSync(() => mount(EditorForm, { target, props: { collection: 'stories', definition: manifest.collections.stories, entry, canWrite: true, canTrash: true } }));
  await tick(); return { target, entry };
}
async function edit(target: HTMLElement, field: string, value: string) {
  const input = target.querySelector(`[data-field="${field}"]`) as HTMLInputElement;
  input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); await tick();
}
it('actual programmatic autosave enters pending and preserves later typing through a second stored revision', async () => {
  const { target, entry } = await render();
  delay = new Promise(resolve => { release = resolve; });
  await edit(target, 'title', 'Sent snapshot');
  await vi.waitFor(() => expect(requestCount).toBe(1), { timeout: 4000 });
  expect(target.querySelector('button')?.textContent).toBe('Saving...');
  await edit(target, 'title', 'Typed while saving'); release!(); delay = undefined;
  await vi.waitFor(() => expect(target.querySelector('button')?.textContent).toBe('Saved'), { timeout: 5000 });
  const stored = await fixture.query('getContent', { collection: 'stories', id: entry.id }, 'author');
  expect(stored.data.title).toBe('Typed while saving');
  expect((target.querySelector('input[name="_rev"]') as HTMLInputElement).value).toBe(stored._rev);
});

it('actual terminal autosave validation displays the issue and stops repeating until changed', async () => {
  const { target, entry } = await render();
  // Advance only the native UI clock; actual HTTP/storage responses stay real.
  // Retain the original five-second test deadline and production 2000ms delay.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  await edit(target, 'summary', 'short');
  await vi.advanceTimersByTimeAsync(2000);
  await vi.waitFor(() => expect(target.querySelector('[role="alert"]')?.textContent ?? '').toContain('Summary needs at least 10 characters.'), { timeout: 4000 });
  await vi.advanceTimersByTimeAsync(2200); expect(requestCount).toBe(1);
  expect((target.querySelector('[data-field="summary"]') as HTMLInputElement).value).toBe('short');
  await edit(target, 'summary', 'Long enough now');
  await vi.advanceTimersByTimeAsync(2000);
  await vi.waitFor(() => expect(target.querySelector('button')?.textContent).toBe('Saved'), { timeout: 4000 });
  expect((await fixture.query('getContent', { collection: 'stories', id: entry.id }, 'author')).data.summary).toBe('Long enough now');
});

it('actual explicit conflict retry reads the latest token and commits through the editor save lifecycle', async () => {
  const { target, entry } = await render();
  await fixture.mutate('updateContent', { collection: 'stories', id: entry.id, _rev: entry._rev, data: JSON.stringify({ title: 'Changed elsewhere' }) }, 'author');
  await edit(target, 'title', 'Writer copy');
  target.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(target.textContent).toContain('Save anyway'));
  const retry = [...target.querySelectorAll('button')].find(button => button.textContent === 'Save anyway')!;
  retry.click();
  await vi.waitFor(() => expect(target.querySelector('button')?.textContent).toBe('Saved'));
  const stored = await fixture.query('getContent', { collection: 'stories', id: entry.id }, 'author');
  expect(stored.data.title).toBe('Writer copy');
  expect((target.querySelector('input[name="_rev"]') as HTMLInputElement).value).toBe(stored._rev);
});
