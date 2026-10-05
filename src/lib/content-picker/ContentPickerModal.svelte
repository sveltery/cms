<script lang="ts">
  // Native rendering of the complete pinned ContentPickerModal contract.
  // EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
  // Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
  import { untrack } from 'svelte';
  import { getDashboardQueryClient } from '../dashboard/query.svelte';
  import MenuDialog from '../menus/MenuDialog.svelte';
  import { InfiniteQueryObserver, QueryObserver, type InfiniteData, type InfiniteQueryObserverResult, type QueryClient } from '@tanstack/react-query';
  import { contentPickerClient, getDraftStatus } from './client.ts';
  import { getEntryTitle } from './entry-title.ts';
  import { pickerQueryClient } from './cache.ts';
  import type { ContentItem, ContentPickerClient, FindManyResult, PickedContentEntry, PickerManifest } from './types.ts';
  const EMPTY_SELECTED: ReadonlySet<string> = new Set();
  let { open, onOpenChange, collection, multiple = false, selectedIds = EMPTY_SELECTED, onConfirm, title, locale, client = contentPickerClient, queryClient: suppliedQueryClient }:
    { open: boolean; onOpenChange: (open: boolean) => void; collection?: string; multiple?: boolean; selectedIds?: ReadonlySet<string>;
      onConfirm: (rows: PickedContentEntry[]) => void; title?: string; locale?: string; client?: ContentPickerClient; queryClient?: QueryClient } = $props();
  const id = $props.id();
  const locked = $derived(!!collection);
  const applicationQueryClient = untrack(getDashboardQueryClient);
  const queryClient = $derived(suppliedQueryClient ?? (client === contentPickerClient ? applicationQueryClient : undefined) ?? pickerQueryClient(client));
  let searchQuery = $state(''), debouncedSearch = $state(''), dropdownCollection = $state('');
  let picked = $state<Record<string, PickedContentEntry>>({});
  let collections = $state<{ slug: string; label: string }[]>([]), manifest = $state<PickerManifest | undefined>();
  let data = $state.raw<InfiniteData<FindManyResult<ContentItem>> | undefined>();
  let loading = $state(false), error = $state<unknown>(), fetchingNext = $state(false), hasNextPage = $state(false);
  let searchInput = $state<HTMLInputElement | undefined>();
  type ContentObserver = InfiniteQueryObserver<FindManyResult<ContentItem>, Error, InfiniteData<FindManyResult<ContentItem>>, readonly ['content-picker', string, string], string | undefined>;
  let contentObserver = $state.raw<ContentObserver | undefined>();
  const activeCollection = $derived(collection ?? dropdownCollection);
  const trimmedSearch = $derived(debouncedSearch.trim());
  const titleField = $derived(manifest?.collections[activeCollection]?.titleField);
  const dialogTitle = $derived(title ?? (multiple ? 'Add references' : 'Select content'));
  const pickedCount = $derived(Object.keys(picked).length);

  $effect(() => { const value = searchQuery; const timer = setTimeout(() => { debouncedSearch = value; }, 300); return () => clearTimeout(timer); });
  $effect(() => { if (open && searchInput) searchInput.focus(); });
  $effect(() => { const current = queryClient; current.mount(); return () => current.unmount(); });
  $effect(() => {
    if (open) { searchQuery = ''; picked = {}; if (!locked) dropdownCollection = ''; }
  });
  $effect(() => {
    const api = client;
    const observer = new QueryObserver(queryClient, { queryKey: ['collections'], queryFn: () => api.fetchCollections(), enabled: open && !locked });
    const sync = (result: ReturnType<typeof observer.getCurrentResult>) => { collections = result.data ?? []; };
    sync(observer.getCurrentResult()); return observer.subscribe(sync);
  });
  $effect(() => { if (!locked && collections.length && !dropdownCollection) dropdownCollection = collections[0].slug; });
  $effect(() => {
    const api = client;
    const observer = new QueryObserver(queryClient, { queryKey: ['manifest'], queryFn: () => api.fetchManifest(), enabled: open });
    const sync = (result: ReturnType<typeof observer.getCurrentResult>) => { manifest = result.data; };
    sync(observer.getCurrentResult()); return observer.subscribe(sync);
  });
  $effect(() => {
    const api = client, slug = activeCollection, search = trimmedSearch;
    const observer: ContentObserver = new InfiniteQueryObserver(queryClient, {
      queryKey: ['content-picker', slug, search] as const,
      queryFn: ({ pageParam }) => api.fetchContentList(slug, { limit: 50, cursor: pageParam, search: search || undefined }),
      initialPageParam: undefined as string | undefined, getNextPageParam: lastPage => lastPage.nextCursor,
      enabled: open && !!slug
    });
    contentObserver = observer;
    const sync = (result: InfiniteQueryObserverResult<InfiniteData<FindManyResult<ContentItem>>, Error>) => {
      data = result.data; loading = result.isLoading; error = result.error; fetchingNext = result.isFetchingNextPage; hasNextPage = result.hasNextPage;
    };
    sync(observer.getCurrentResult()); return observer.subscribe(sync);
  });
  const items = $derived.by(() => {
    const flat = data?.pages.flatMap(page => page.items) ?? []; if (!locale) return flat;
    const byGroup = new Map<string, ContentItem>(), order: string[] = [];
    for (const item of flat) {
      const key = item.translationGroup ?? item.id, existing = byGroup.get(key);
      if (!existing) { byGroup.set(key, item); order.push(key); }
      else if (existing.locale !== locale && (item.locale === locale || item.locale < existing.locale)) byGroup.set(key, item);
    }
    return order.map(key => byGroup.get(key)!);
  });
  function selectionKey(item: ContentItem) { return locale ? item.translationGroup ?? item.id : item.id; }
  function pickedEntry(item: ContentItem): PickedContentEntry {
    return { collection: activeCollection, id: item.id, slug: item.slug, title: getEntryTitle(item, titleField), locale: item.locale, translationGroup: item.translationGroup };
  }
  function togglePicked(item: ContentItem) { const next = { ...picked }; if (next[item.id]) delete next[item.id]; else next[item.id] = pickedEntry(item); picked = next; }
  function choose(item: ContentItem) { onConfirm([pickedEntry(item)]); onOpenChange(false); }
  function confirmMultiple() { onConfirm(Object.values(picked)); onOpenChange(false); }
  function retry() { void contentObserver?.refetch(); }
  function loadMore() { void contentObserver?.fetchNextPage(); }
  function statusLabel(item: ContentItem) { const status = getDraftStatus(item); return status === 'published' ? 'Published' : status === 'published_with_changes' ? 'Pending changes' : 'Draft'; }
</script>

{#if open}
  <MenuDialog labelledBy={`${id}-title`} onClose={() => onOpenChange(false)}>
    <div class="picker">
      <header><h2 id={`${id}-title`}>{dialogTitle}</h2><button aria-label="Close" onclick={() => onOpenChange(false)}>×</button></header>
      <div class="filters"><input bind:this={searchInput} type="search" placeholder="Search content..." aria-label="Search content..." bind:value={searchQuery} />
        {#if !locked}<label for={`${id}-collection`}>Collection</label><select id={`${id}-collection`} aria-label="Collection" value={dropdownCollection}
          onchange={event => { dropdownCollection = event.currentTarget.value; picked = {}; }}>{#each collections as value}<option value={value.slug}>{value.label}</option>{/each}</select>{/if}
      </div>
      <div class="results">
        {#if loading}<p class="empty">Loading content...</p>
        {:else if error && !items.length}<div class="empty"><p class="error">Couldn't load content.</p><button type="button" onclick={retry}>Retry</button></div>
        {:else if !items.length}<div class="empty">{#if trimmedSearch}<p>No content found</p><p>Try adjusting your search</p>{:else}<p>No content in this collection</p>{/if}</div>
        {:else}
          {#each items as item (item.id)}{@const alreadyLinked = selectedIds.has(selectionKey(item))}{@const isPicked = alreadyLinked || !!picked[item.id]}
            {#if multiple}<label class:linked={alreadyLinked} class="row"><input type="checkbox" checked={isPicked} disabled={alreadyLinked} onchange={() => togglePicked(item)} aria-label={getEntryTitle(item, titleField)} />
              <span><strong>{getEntryTitle(item, titleField)}</strong><span class="meta">{statusLabel(item)}{#if item.slug} / {item.slug}{/if}</span></span></label>
            {:else}<button type="button" class="row single" disabled={alreadyLinked} onclick={() => choose(item)}><strong>{getEntryTitle(item, titleField)}</strong><span class="meta">{statusLabel(item)}{#if item.slug} / {item.slug}{/if}</span></button>{/if}
          {/each}
          {#if hasNextPage}<div class="more"><button disabled={fetchingNext} onclick={loadMore}>{fetchingNext ? 'Loading...' : 'Load more'}</button></div>{/if}
        {/if}
      </div>
      <footer><button onclick={() => onOpenChange(false)}>Cancel</button>{#if multiple}<button disabled={!pickedCount} onclick={confirmMultiple}>Add selected</button>{/if}</footer>
    </div>
  </MenuDialog>
{/if}
<style>
  .picker { display:flex; flex-direction:column; height:75vh; } header,footer,.filters { display:flex; align-items:center; gap:.75rem; } header { justify-content:space-between; } h2 { margin:0; } .filters { border-block-end:1px solid #d4d4d8; padding-block:1rem; } .filters input { flex:1; min-width:0; } input,select,button { font:inherit; } input,select,button { padding:.55rem .7rem; border:1px solid #a1a1aa; border-radius:.35rem; } button { cursor:pointer; } button:disabled,.linked { cursor:default; opacity:.6; } .results { overflow-y:auto; flex:1; padding-block:1rem; } .row { display:flex; align-items:start; gap:.75rem; padding:.6rem; border-radius:.35rem; margin-block-end:.25rem; } .single { display:block; text-align:start; width:100%; border:0; background:transparent; } .row:not(.linked):hover { background:#f4f4f5; } .row input { margin-block-start:.2rem; } .meta { display:block; font-size:.875rem; color:#52525b; margin-block-start:.2rem; } .empty { text-align:center; padding-block:2rem; } .error { color:#b91c1c; } .more { text-align:center; padding-block-start:.5rem; } footer { justify-content:end; border-block-start:1px solid #d4d4d8; padding-block-start:1rem; }
</style>
