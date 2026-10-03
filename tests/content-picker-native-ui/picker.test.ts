import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushSync, tick, unmount } from 'svelte';
import Host from '../helpers/content-picker/PickerHost.svelte';
import { pickerState } from '../helpers/content-picker/state.svelte.ts';
const instances: ReturnType<typeof mount>[] = [];
afterEach(async () => { vi.useRealTimers(); for (const instance of instances.splice(0)) await unmount(instance); document.body.replaceChildren(); });
const row = (id = 'post-en', data = { title: 'English' }, locale = 'en', group: string | null = 'group') => ({ id, type: 'posts', data, locale, translationGroup: group,
  slug: id, liveRevisionId: null, draftRevisionId: null });
function client(items = [row()]) { return { fetchCollections: vi.fn(async () => [{ slug: 'posts', label: 'Posts' }, { slug: 'people', label: 'People' }]),
  fetchManifest: vi.fn(async () => ({ collections: { posts: { titleField: 'display_name' } } })),
  fetchContentList: vi.fn(async (_collection: string, _options: any) => ({ items, nextCursor: undefined as string | undefined })) }; }
async function settle() { for (let i = 0; i < 8; i++) { await Promise.resolve(); await tick(); } }
async function render(props: Record<string, any>) { const target = document.createElement('div'); document.body.append(target);
  const state = pickerState({ open: true, onOpenChange: vi.fn(), onConfirm: vi.fn(), ...props });
  instances.push(flushSync(() => mount(Host, { target, props: { state } }))); await settle(); return { target, state }; }
async function click(target: HTMLElement, title: string) { const button = [...target.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === title || button.getAttribute('aria-label') === title || [...button.children].some(child => child.textContent === title));
  expect(button).toBeDefined(); button!.click(); await settle(); }
it('locked collection hides the selector and skips collection discovery', async () => {
  const api = client(); const { target } = await render({ collection: 'posts', client: api });
  expect(target.querySelector('select')).toBeNull(); expect(api.fetchCollections).not.toHaveBeenCalled(); expect(target.textContent).toContain('English');
});
it('unlocked picker lists every available collection and switches without staged leftovers', async () => {
  const api = client(); const { target } = await render({ multiple: true, client: api });
  expect([...target.querySelectorAll('option')].map(option => option.value)).toEqual(['posts', 'people']);
  target.querySelector<HTMLInputElement>('input[type=checkbox]')!.click(); await settle();
  const select = target.querySelector('select')!; select.value = 'people'; select.dispatchEvent(new Event('change', { bubbles: true })); await settle();
  expect([...target.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Add selected')!.disabled).toBe(true);
});
it('uses manifest titleField before title/name and preserves Source revision status', async () => {
  const api = client([row('a', { title: 'Fallback', display_name: 'Display name' } as any)]);
  const { target } = await render({ collection: 'posts', client: api }); expect(target.textContent).toContain('Display name'); expect(target.textContent).not.toContain('Fallback'); expect(target.textContent).toContain('Draft');
});
it('single selection emits actual identity and closes immediately', async () => {
  const api = client(); const { target, state } = await render({ collection: 'posts', client: api }); await click(target, 'English');
  expect(state.onConfirm).toHaveBeenCalledWith([{ collection: 'posts', id: 'post-en', slug: 'post-en', title: 'English', locale: 'en', translationGroup: 'group' }]); expect(state.onOpenChange).toHaveBeenCalledWith(false);
});
it('multiple staging toggles choices and confirms only staged rows', async () => {
  const api = client([row(), row('post-fr', { title: 'French' }, 'fr')]); const { target, state } = await render({ collection: 'posts', multiple: true, client: api });
  const boxes = [...target.querySelectorAll<HTMLInputElement>('input[type=checkbox]')]; boxes[0].click(); boxes[1].click(); boxes[0].click(); await settle(); await click(target, 'Add selected');
  expect(state.onConfirm).toHaveBeenCalledWith([expect.objectContaining({ id: 'post-fr', locale: 'fr' })]);
});
it('selectedIds disables a translation group when locale is supplied', async () => {
  const { target } = await render({ collection: 'posts', multiple: true, locale: 'fr', selectedIds: new Set(['group']), client: client() });
  const checkbox = target.querySelector<HTMLInputElement>('input[type=checkbox]')!; expect(checkbox.checked).toBe(true); expect(checkbox.disabled).toBe(true);
});
it('locale prefers matching translation and otherwise the lowest locale', async () => {
  const api = client([row('fr', { title: 'French' }, 'fr'), row('de', { title: 'German' }, 'de'), row('en', { title: 'English' }, 'en'), row('z', { title: 'Zebra' }, 'zh', 'other'), row('ar', { title: 'Arabic' }, 'ar', 'other')]);
  const { target } = await render({ collection: 'posts', locale: 'en', client: api }); expect(target.textContent).toContain('English'); expect(target.textContent).toContain('Arabic'); expect(target.textContent).not.toContain('French'); expect(target.textContent).not.toContain('Zebra');
});
it('no locale preserves every translation and selectedIds matches row identity', async () => {
  const api = client([row(), row('post-fr', { title: 'French' }, 'fr')]); const { target } = await render({ collection: 'posts', multiple: true, selectedIds: new Set(['post-en']), client: api });
  const boxes = [...target.querySelectorAll<HTMLInputElement>('input[type=checkbox]')]; expect(boxes).toHaveLength(2); expect(boxes[0].disabled).toBe(true); expect(boxes[1].disabled).toBe(false);
});
it('cursor pages accumulate and reopen preserves cached visible rows while refreshing', async () => {
  const api = client(); let refresh!: (value: any) => void;
  api.fetchContentList.mockResolvedValueOnce({ items: [row()], nextCursor: 'next' }).mockResolvedValueOnce({ items: [row('b', { title: 'Second' })], nextCursor: undefined });
  const { target, state } = await render({ collection: 'posts', client: api }); await click(target, 'Load more'); expect(target.textContent).toContain('English'); expect(target.textContent).toContain('Second');
  state.open = false; await settle(); api.fetchContentList.mockImplementationOnce(() => new Promise(resolve => { refresh = resolve; })); state.open = true; await settle();
  expect(target.textContent).toContain('English'); expect(target.textContent).toContain('Second'); expect(target.textContent).not.toContain('Loading content...');
  refresh({ items: [row('fresh', { title: 'Refreshed' })], nextCursor: undefined }); await settle(); expect(target.textContent).toContain('Refreshed');
});
it('search waits 300ms, trims the query and resets cursor accumulation', async () => {
  vi.useFakeTimers(); const api = client(); const { target } = await render({ collection: 'posts', client: api });
  const input = target.querySelector<HTMLInputElement>('input[placeholder="Search content..."]')!; input.value = '  needle  '; input.dispatchEvent(new Event('input', { bubbles: true })); await settle();
  await vi.advanceTimersByTimeAsync(299); expect(api.fetchContentList).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1); await settle(); expect(api.fetchContentList).toHaveBeenLastCalledWith('posts', { limit: 50, cursor: undefined, search: 'needle' });
});
it('failed reads show retry without claiming an empty collection', async () => {
  const api = client(); api.fetchContentList.mockRejectedValueOnce(new Error('Failure')).mockResolvedValueOnce({ items: [row()], nextCursor: undefined });
  const { target } = await render({ collection: 'posts', client: api }); expect(target.textContent).toContain("Couldn't load content."); expect(target.textContent).not.toContain('No content in this collection'); await click(target, 'Retry'); expect(target.textContent).toContain('English');
});
it('old search response cannot replace newer results after switching collections', async () => {
  const api = client(); let old!: (value: any) => void; api.fetchContentList.mockImplementationOnce(() => new Promise(resolve => { old = resolve; })).mockResolvedValueOnce({ items: [row('b', { title: 'New collection' })], nextCursor: undefined });
  const { target } = await render({ client: api }); const select = target.querySelector('select')!; select.value = 'people'; select.dispatchEvent(new Event('change', { bubbles: true })); await settle();
  old({ items: [row('a', { title: 'Old collection' })], nextCursor: undefined }); await settle(); expect(target.textContent).toContain('New collection'); expect(target.textContent).not.toContain('Old collection');
});
it('simultaneous picker instances share metadata and one pending content read', async () => {
  const api = client(); let resolveContent!: (value: any) => void, resolveCollections!: (value: any) => void, resolveManifest!: (value: any) => void;
  api.fetchCollections.mockImplementation(() => new Promise(resolve => { resolveCollections = resolve; }));
  api.fetchManifest.mockImplementation(() => new Promise(resolve => { resolveManifest = resolve; }));
  api.fetchContentList.mockImplementationOnce(() => new Promise(resolve => { resolveContent = resolve; }));
  const first = await render({ client: api }); const second = await render({ client: api });
  expect(api.fetchCollections).toHaveBeenCalledTimes(1); expect(api.fetchManifest).toHaveBeenCalledTimes(1);
  resolveCollections([{ slug: 'posts', label: 'Posts' }]); resolveManifest({ collections: { posts: {} } }); await settle();
  expect(api.fetchContentList).toHaveBeenCalledTimes(1);
  resolveContent({ items: [row()], nextCursor: undefined }); await settle();
  expect(first.target.textContent).toContain('English'); expect(second.target.textContent).toContain('English');
});
it('switching collections detaches an old next-page loading state from the active query', async () => {
  const api = client(); let finishOld!: (value: any) => void;
  api.fetchContentList.mockResolvedValueOnce({ items: [row()], nextCursor: 'old-next' })
    .mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockResolvedValueOnce({ items: [row('people', { title: 'Person' })], nextCursor: 'people-next' });
  const { target } = await render({ client: api }); await click(target, 'Load more');
  const select = target.querySelector('select')!; select.value = 'people'; select.dispatchEvent(new Event('change', { bubbles: true })); await settle();
  expect(target.textContent).toContain('Person'); expect(target.textContent).toContain('Load more'); expect(target.textContent).not.toContain('Loading...');
  const more = [...target.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Load more')!; expect(more.disabled).toBe(false);
  finishOld({ items: [row('old', { title: 'Old page' })], nextCursor: undefined }); await settle(); expect(target.textContent).not.toContain('Old page');
});
it('two instances observe one shared next-page loading state', async () => {
  const api = client(); let finishMore!: (value: any) => void;
  api.fetchContentList.mockResolvedValue({ items: [row()], nextCursor: 'next' });
  const first = await render({ collection: 'posts', client: api }); const second = await render({ collection: 'posts', client: api });
  api.fetchContentList.mockImplementationOnce(() => new Promise(resolve => { finishMore = resolve; }));
  await click(first.target, 'Load more'); expect(second.target.textContent).toContain('Loading...');
  expect([...second.target.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Loading...')!.disabled).toBe(true);
  finishMore({ items: [row('second', { title: 'Second' })], nextCursor: undefined }); await settle();
  expect(first.target.textContent).toContain('Second'); expect(second.target.textContent).toContain('Second');
});
it('a metadata refresh updates already open observers of the same cached manifest', async () => {
  vi.useFakeTimers(); const api = client([row('a', { title: 'Fallback', display_name: 'Manifest title' } as any)]);
  api.fetchManifest.mockResolvedValueOnce({ collections: { posts: { titleField: 'title' } } })
    .mockResolvedValueOnce({ collections: { posts: { titleField: 'display_name' } } });
  const first = await render({ collection: 'posts', client: api }); expect(first.target.textContent).toContain('Fallback');
  await vi.advanceTimersByTimeAsync(60_001); const second = await render({ collection: 'posts', client: api });
  expect(second.target.textContent).toContain('Manifest title'); expect(first.target.textContent).toContain('Manifest title'); expect(first.target.textContent).not.toContain('Fallback');
});
it('locale references collapse translations that arrive on later cursor pages without filtering the server request', async () => {
  const api = client(); api.fetchContentList.mockResolvedValueOnce({ items: [row('en', { title: 'English' })], nextCursor: 'next' })
    .mockResolvedValueOnce({ items: [row('fr', { title: 'French' }, 'fr')], nextCursor: undefined });
  const { target, state } = await render({ collection: 'posts', locale: 'fr', client: api });
  await click(target, 'Load more'); expect(target.textContent).toContain('French'); expect(target.textContent).not.toContain('English');
  expect(api.fetchContentList).toHaveBeenLastCalledWith('posts', { limit: 50, cursor: 'next', search: undefined });
  await click(target, 'French'); expect(state.onConfirm).toHaveBeenCalledWith([expect.objectContaining({ id: 'fr', translationGroup: 'group', locale: 'fr' })]);
});
