import { afterEach, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import { QueryClient } from '@tanstack/react-query';
import Picker from '../../src/lib/content-picker/ContentPickerModal.svelte';
import { pickerQueryClient } from '../../src/lib/content-picker/cache.ts';
import type { ContentPickerClient, ContentItem, FindManyResult } from '../../src/lib/content-picker/types.ts';

const instances: ReturnType<typeof mount>[] = [];
afterEach(async () => {
  vi.useRealTimers();
  for (const instance of instances.splice(0)) await unmount(instance);
  document.body.replaceChildren();
});

// These are actual class instances: their shared prototype methods read their receiver.
class AccountPickerClient implements ContentPickerClient {
  collectionReads = 0;
  manifestReads = 0;
  contentReads = 0;
  constructor(readonly account: string) {}
  async fetchCollections() {
    this.collectionReads++;
    return [{ slug: 'posts', label: `${this.account} posts` }];
  }
  async fetchManifest() {
    this.manifestReads++;
    return { collections: { posts: { titleField: `${this.account}_title` } } };
  }
  async fetchContentList(): Promise<FindManyResult<ContentItem>> {
    this.contentReads++;
    return { items: [{ id: `${this.account}-post`, type: 'posts', slug: `${this.account}-post`,
      data: { title: 'Fallback title', [`${this.account}_title`]: `${this.account} entry` },
      locale: 'en', translationGroup: null, liveRevisionId: null, draftRevisionId: null }], nextCursor: undefined };
  }
}

async function settle() {
  for (let index = 0; index < 12; index++) { await Promise.resolve(); await tick(); }
}
async function render(client: ContentPickerClient, queryClient?: QueryClient) {
  const target = document.createElement('div');
  document.body.append(target);
  instances.push(flushSync(() => mount(Picker, { target,
    props: { open: true, onOpenChange() {}, onConfirm() {}, client, queryClient } })));
  await settle();
  return target;
}

it('standalone class clients with a shared read method keep their content isolated', async () => {
  const alice = new AccountPickerClient('Alice'), bob = new AccountPickerClient('Bob');
  expect(alice.fetchContentList).toBe(bob.fetchContentList);
  const alicePicker = await render(alice), bobPicker = await render(bob);
  expect(alicePicker.querySelector('.row strong')?.textContent).toBe('Alice entry');
  expect(bobPicker.querySelector('.row strong')?.textContent).toBe('Bob entry');
  expect([alice.contentReads, bob.contentReads]).toEqual([1, 1]);
});

it('standalone class clients keep collection and manifest results isolated', async () => {
  const alice = new AccountPickerClient('Alice'), bob = new AccountPickerClient('Bob');
  expect(alice.fetchCollections).toBe(bob.fetchCollections);
  expect(alice.fetchManifest).toBe(bob.fetchManifest);
  await render(alice);
  const bobPicker = await render(bob);
  expect(bobPicker.querySelector('option')?.textContent).toBe('Bob posts');
  expect(pickerQueryClient(bob).getQueryData(['manifest'])).toEqual({ collections: { posts: { titleField: 'Bob_title' } } });
  expect([alice.collectionReads, bob.collectionReads, alice.manifestReads, bob.manifestReads]).toEqual([1, 1, 1, 1]);
});

it('standalone mounts using the same client reuse fresh content and metadata', async () => {
  vi.useFakeTimers();
  const client = new AccountPickerClient('Alice');
  const first = await render(client);
  await vi.advanceTimersByTimeAsync(59_999);
  const second = await render(client);
  expect(first.querySelector('.row strong')?.textContent).toBe('Alice entry');
  expect(second.querySelector('.row strong')?.textContent).toBe('Alice entry');
  expect([client.collectionReads, client.manifestReads, client.contentReads]).toEqual([1, 1, 1]);
});

it('an explicit QueryClient remains the standalone observer cache owner', async () => {
  const alice = new AccountPickerClient('Alice'), bob = new AccountPickerClient('Bob');
  const aliceQueries = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: false } } });
  const bobQueries = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: false } } });
  await render(alice, aliceQueries);
  const bobPicker = await render(bob, bobQueries);
  expect(bobPicker.querySelector('.row strong')?.textContent).toBe('Bob entry');
  expect(aliceQueries.getQueryData(['manifest'])).toEqual({ collections: { posts: { titleField: 'Alice_title' } } });
  expect(bobQueries.getQueryData(['manifest'])).toEqual({ collections: { posts: { titleField: 'Bob_title' } } });
  expect(pickerQueryClient(bob).getQueryData(['manifest'])).toBeUndefined();
  expect([alice.contentReads, bob.contentReads]).toEqual([1, 1]);
});

it('standalone client caches preserve the Source one-minute freshness and one retry', () => {
  const alice = new AccountPickerClient('Alice'), bob = new AccountPickerClient('Bob');
  expect(pickerQueryClient(alice).getDefaultOptions().queries).toEqual({ staleTime: 60_000, retry: 1 });
  expect(pickerQueryClient(bob).getDefaultOptions().queries).toEqual({ staleTime: 60_000, retry: 1 });
});
