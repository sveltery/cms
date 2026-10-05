import { afterEach, expect, it, vi } from 'vitest';
import { flushSync, mount, settled, unmount } from 'svelte';
import Host from '../helpers/admin-app/ClientOverridesHost.svelte';
import NativeAppHost from '../helpers/admin-app/NativeAppHost.svelte';
import type { QueryClient } from '@tanstack/query-core';
import type { ContentItem, FindManyResult } from '../../src/lib/content-picker/types';
import { lifecycleState } from '../helpers/dashboard-welcome/lifecycle-state.svelte';
const instances: ReturnType<typeof mount>[] = [];
afterEach(async () => { for (const instance of instances.splice(0)) await unmount(instance); document.body.replaceChildren(); localStorage.clear(); });
const alice = { id: 'override-alice', email: 'alice@example.test', name: 'Alice', avatarUrl: null, role: 40, isFirstLogin: true };
const bob = { ...alice, id: 'override-bob', email: 'bob@example.test', name: 'Bob' };
async function render(state: any) {
 const target = document.createElement('div'); document.body.append(target);
 instances.push(flushSync(() => mount(Host, { target, props: { state } })));
 await settled(); return target;
}
it('actual default account consumers retain the root current-user cache and Source freshness', async () => {
 const target = document.createElement('div'); document.body.append(target);
 let queryClient!: QueryClient;
 const seededUser = { ...alice, isFirstLogin: false };
 instances.push(flushSync(() => mount(NativeAppHost, { target, props: {
  state: { showSecond: true }, onQueryClient: (client: QueryClient) => { queryClient = client; client.setQueryData(['currentUser'], seededUser); }
 } })));
 await settled();
 await vi.waitFor(() => expect(queryClient.getQueryCache().find({ queryKey: ['currentUser'] })?.getObserversCount()).toBe(2));
 const query = queryClient.getQueryCache().find({ queryKey: ['currentUser'] })!;
 expect([query.state.data, (query.options as { staleTime?: number }).staleTime, query.options.retry, query.state.fetchStatus]).toEqual([seededUser, 300_000, false, 'idle']);
});
it('sequential explicit account clients under one root render their own identity', async () => {
 const first = { currentUser: vi.fn(async () => alice), dismissWelcome: vi.fn(async () => {}) };
 const second = { currentUser: vi.fn(async () => bob), dismissWelcome: vi.fn(async () => {}) };
 const state = lifecycleState({ accounts: [first] }); const target = await render(state);
 await vi.waitFor(() => expect(target.querySelector('[data-account="0"] [role=dialog]')?.textContent).toContain('Alice'));
 state.accounts = [first, second]; await settled();
 await vi.waitFor(() => expect(target.querySelector('[data-account="1"] [role=dialog]')?.textContent).toContain('Bob'));
 expect([first.currentUser.mock.calls.length, second.currentUser.mock.calls.length]).toEqual([1, 1]);
});
it('concurrent explicit account clients keep their pending reads and welcome dismissal separate', async () => {
 let resolveAlice!: (value: typeof alice) => void, resolveBob!: (value: typeof bob) => void;
 const first = { currentUser: vi.fn(() => new Promise<typeof alice>(resolve => { resolveAlice = resolve; })), dismissWelcome: vi.fn(async () => {}) };
 const second = { currentUser: vi.fn(() => new Promise<typeof bob>(resolve => { resolveBob = resolve; })), dismissWelcome: vi.fn(async () => {}) };
 const target = await render({ accounts: [first, second] });
 try {
  await vi.waitFor(() => expect([first.currentUser.mock.calls.length, second.currentUser.mock.calls.length]).toEqual([1, 1]));
  resolveAlice(alice); resolveBob(bob); await settled();
  await vi.waitFor(() => expect([...target.querySelectorAll('[role=dialog] h2')].map(element => element.textContent)).toEqual(['Welcome to Sveltery CMS, Alice!', 'Welcome to Sveltery CMS, Bob!']));
  target.querySelector<HTMLButtonElement>('[data-account="0"] button.primary')!.click();
  await vi.waitFor(() => expect(target.querySelector('[data-account="0"] [role=dialog]')).toBeNull());
  expect(target.querySelector('[data-account="1"] [role=dialog]')?.textContent).toContain('Bob');
  expect([first.dismissWelcome.mock.calls.length, second.dismissWelcome.mock.calls.length]).toEqual([1, 0]);
 } finally { resolveAlice?.(alice); resolveBob?.(bob); await settled(); }
});
function picker(label: string) {
 return { fetchCollections: vi.fn(async () => [{ slug: 'posts', label: `${label} collection` }]),
  fetchManifest: vi.fn(async () => ({ collections: { posts: { titleField: label === 'Alice' ? 'aliceTitle' : 'bobTitle' } } })),
  fetchContentList: vi.fn(async (): Promise<FindManyResult<ContentItem>> => ({ items: [{ id: label, type: 'posts', data: { aliceTitle: 'Alice content', bobTitle: 'Bob content' }, locale: 'en', translationGroup: null, slug: label, liveRevisionId: null, draftRevisionId: null }] })) };
}
it('sequential explicit picker clients under one root render their own metadata and rows', async () => {
 const first = picker('Alice'), second = picker('Bob'), state = lifecycleState({ pickers: [first] });
 const target = await render(state);
 await vi.waitFor(() => expect(target.querySelector('[data-picker="0"] .single strong')?.textContent).toBe('Alice content'));
 state.pickers = [first, second]; await settled();
 await vi.waitFor(() => expect(target.querySelector('[data-picker="1"] .single strong')?.textContent).toBe('Bob content'));
 expect(target.querySelector('[data-picker="1"] option')?.textContent).toBe('Bob collection');
 expect([second.fetchCollections.mock.calls.length, second.fetchManifest.mock.calls.length, second.fetchContentList.mock.calls.length]).toEqual([1, 1, 1]);
});
it('concurrent explicit picker clients under one root fetch independently', async () => {
 const first = picker('Alice'), second = picker('Bob'); const target = await render({ pickers: [first, second] });
 await vi.waitFor(() => expect([first.fetchContentList.mock.calls.length, second.fetchContentList.mock.calls.length]).toEqual([1, 1]));
 await vi.waitFor(() => expect([...target.querySelectorAll('.single strong')].map(element => element.textContent)).toEqual(['Alice content', 'Bob content']));
 expect([...target.querySelectorAll('option')].map(element => element.textContent)).toEqual(['Alice collection', 'Bob collection']);
});
it('separate actual roots do not reuse an explicit picker client warm cache', async () => {
 const api = picker('Alice');
 api.fetchContentList.mockResolvedValueOnce({ items: [{ id: 'first-root', type: 'posts', data: { aliceTitle: 'First root content' }, locale: 'en', translationGroup: null, slug: 'first-root', liveRevisionId: null, draftRevisionId: null }] });
 api.fetchContentList.mockResolvedValueOnce({ items: [{ id: 'second-root', type: 'posts', data: { aliceTitle: 'Second root content' }, locale: 'en', translationGroup: null, slug: 'second-root', liveRevisionId: null, draftRevisionId: null }] });
 const first = await render({ pickers: [api] });
 await vi.waitFor(() => expect(first.querySelector('.single strong')?.textContent).toBe('First root content'));
 const second = await render({ pickers: [api] });
 await vi.waitFor(() => expect(second.querySelector('.single strong')?.textContent).toBe('Second root content'));
 expect([api.fetchCollections.mock.calls.length, api.fetchManifest.mock.calls.length, api.fetchContentList.mock.calls.length]).toEqual([2, 2, 2]);
});
