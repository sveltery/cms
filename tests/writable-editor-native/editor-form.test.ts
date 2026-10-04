import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes';
import { useFixture } from '../helpers/writable-editor-dom/remotes';
import { app, navigation } from '../helpers/writable-editor-dom/framework';
import { resolve } from 'node:path';
import EditorForm from '../../src/lib/editor/EditorForm.svelte';

// Original complete owned-form transport regressions. The installed Kit form,
// binary serialization/parser, built HTTP remotes, fixed stored author and
// persisted Node SQLite are real. No successful response/backend is stubbed.
let fixture: Awaited<ReturnType<typeof schemaAdminRemotes>>;
let instance: ReturnType<typeof mount> | undefined;
const actualFetch = globalThis.fetch;
const actualSetTimeout = globalThis.setTimeout;
const actualClearTimeout = globalThis.clearTimeout;
let delay: Promise<void> | undefined;
let release: (() => void) | undefined;
let requestCount = 0;
beforeEach(async () => {
  // Vite rewrites import.meta.url in the shared helper. Pass the real build
  // explicitly; all built HTTP modules and persisted storage remain unchanged.
  fixture = await schemaAdminRemotes('Node', true, { output: resolve(process.cwd(), '.svelte-kit/output') });
  useFixture(fixture); app.decoders = fixture.decoders;
  navigation.callbacks.length = 0; navigation.urls.length = 0;
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
  document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); await fixture?.close();
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
async function renderNew() {
  const manifest = await fixture.query('getEditorManifest', undefined, 'author');
  const target = document.createElement('div'); document.body.append(target);
  instance = flushSync(() => mount(EditorForm, { target, props: {
    collection: 'stories', definition: manifest.collections.stories, canWrite: true, isNew: true,
    entry: { id: '', type: 'stories', locale: 'fr', _rev: '', status: 'draft', slug: null, data: {} }
  } }));
  await tick(); return target;
}
it('actual create form stores the entered locale and navigates using its accepted receipt', async () => {
  const target = await renderNew();
  await edit(target, 'title', 'Créé dans le produit');
  target.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(navigation.urls).toHaveLength(1));
  expect(target.querySelector('[role="alert"]')).toBeNull();
  expect(navigation.urls[0]).toMatch(/^\/content\/stories\/[^/?]+\?locale=fr$/);
  const id = new URL(navigation.urls[0], fixture.origin).pathname.split('/').at(-1)!;
  expect((await fixture.query('getContent', { collection: 'stories', id, locale: 'fr' }, 'author')).data.title).toBe('Créé dans le produit');
});
it('a pristine inline new draft permits navigation and only changed or pending values warn', async () => {
  const target = await renderNew();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const cancel = vi.fn();
  for (const callback of navigation.callbacks) callback({ cancel });
  expect(cancel).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled();
  const pristine = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(pristine);
  expect(pristine.defaultPrevented).toBe(false);
  expect(target.querySelector('button')?.textContent).toBe('Save');
  expect((target.querySelector('button') as HTMLButtonElement).disabled).toBe(false);
  await edit(target, 'title', 'Unsaved writer copy');
  for (const callback of navigation.callbacks) callback({ cancel });
  expect(cancel).toHaveBeenCalledTimes(1); expect(confirm).toHaveBeenCalledTimes(1);
  const changed = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(changed);
  expect(changed.defaultPrevented).toBe(true);
  delay = new Promise(resolve => { release = resolve; });
  target.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(requestCount).toBe(1));
  for (const callback of navigation.callbacks) callback({ cancel });
  expect(cancel).toHaveBeenCalledTimes(2);
  release!(); delay = undefined;
});
it('an accepted actual trash receipt can navigate away from a dirty editor', async () => {
  const { target, entry } = await render();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  await edit(target, 'title', 'Unsaved writer copy');
  target.querySelector('form[aria-label="Move draft to trash"]')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(navigation.urls).toEqual(['/trash/stories']));
  const cancel = vi.fn();
  for (const callback of navigation.callbacks) callback({ cancel });
  expect(cancel).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled();
  expect((await fixture.query('getTrashedContent', { collection: 'stories', id: entry.id }, 'author')).data.title).toBe('Original');
});
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
  // Control only the editor's 2000ms UI timers. Replacing all global timers also
  // stalls actual HTTP internals. All other timers and the 5s deadline stay real.
  const queued: { callback: () => void; active: boolean }[] = [];
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void, delay?: number, ...args: unknown[]) => {
    if (delay !== 2000) return actualSetTimeout(callback, delay, ...args);
    const timer = { callback, active: true }; queued.push(timer); return timer;
  }) as typeof setTimeout);
  vi.spyOn(globalThis, 'clearTimeout').mockImplementation(((timer: ReturnType<typeof setTimeout>) => {
    const ui = queued.find(candidate => candidate === (timer as unknown));
    if (ui) ui.active = false; else actualClearTimeout(timer);
  }) as typeof clearTimeout);
  const advanceUI = async () => {
    for (const timer of queued.splice(0)) if (timer.active) timer.callback();
    await tick();
  };
  await edit(target, 'summary', 'short');
  await advanceUI();
  await vi.waitFor(() => expect(target.querySelector('[role="alert"]')?.textContent ?? '').toContain('Summary needs at least 10 characters.'), { timeout: 4000 });
  await advanceUI(); expect(requestCount).toBe(1);
  expect((target.querySelector('[data-field="summary"]') as HTMLInputElement).value).toBe('short');
  await edit(target, 'summary', 'Long enough now');
  await advanceUI();
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
