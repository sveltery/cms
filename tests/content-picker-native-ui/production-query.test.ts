import { afterEach, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import Picker from '../../src/lib/content-picker/ContentPickerModal.svelte';
const instances: ReturnType<typeof mount>[] = [];
afterEach(async () => { vi.useRealTimers(); for (const instance of instances.splice(0)) await unmount(instance); document.body.replaceChildren(); });
const row = { id: 'one', type: 'posts', slug: 'one', data: { title: 'Entry' }, locale: 'en', translationGroup: 'group', liveRevisionId: null, draftRevisionId: null };
function client() { return { fetchCollections: vi.fn(async () => [{ slug: 'posts', label: 'Posts' }]), fetchManifest: vi.fn(async () => ({ collections: { posts: {} } })),
  fetchContentList: vi.fn(async () => ({ items: [row], nextCursor: undefined })) }; }
async function settle() { for (let index = 0; index < 12; index++) { await Promise.resolve(); await tick(); } }
async function render(api: ReturnType<typeof client>) { const target = document.createElement('div'); document.body.append(target);
  instances.push(flushSync(() => mount(Picker, { target, props: { open: true, onOpenChange() {}, onConfirm() {}, client: api } }))); await settle(); return target; }
it('production provider keeps content and metadata fresh for one minute', async () => {
  vi.useFakeTimers(); const api = client(); await render(api); expect(api.fetchContentList).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(59_999); await render(api);
  expect(api.fetchContentList).toHaveBeenCalledTimes(1); expect(api.fetchCollections).toHaveBeenCalledTimes(1); expect(api.fetchManifest).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(2); await render(api);
  expect(api.fetchContentList).toHaveBeenCalledTimes(2); expect(api.fetchCollections).toHaveBeenCalledTimes(2); expect(api.fetchManifest).toHaveBeenCalledTimes(2);
});
it('production provider retries one transient read using the Source query delay', async () => {
  vi.useFakeTimers(); const api = client(); api.fetchContentList.mockRejectedValueOnce(new Error('Transient')).mockResolvedValueOnce({ items: [row], nextCursor: undefined });
  const target = await render(api); expect(api.fetchContentList).toHaveBeenCalledTimes(1); expect(target.textContent).toContain('Loading content...');
  await vi.advanceTimersByTimeAsync(999); await settle(); expect(api.fetchContentList).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1); await settle(); expect(api.fetchContentList).toHaveBeenCalledTimes(2); expect(target.textContent).toContain('Entry');
});
