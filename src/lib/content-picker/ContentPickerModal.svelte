<script lang="ts">
  // Native rendering of the complete pinned ContentPickerModal contract.
  // EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
  // Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
  import MenuDialog from '../menus/MenuDialog.svelte';
  import { contentPickerClient, getDraftStatus } from './client.ts';
  import { getEntryTitle } from './entry-title.ts';
  import { pickerCache, pickerQuery, notifyQuery, type CachedQuery } from './cache.ts';
  import type { ContentItem, ContentPickerClient, FindManyResult, PickedContentEntry, PickerManifest } from './types.ts';
  const EMPTY_SELECTED: ReadonlySet<string> = new Set();
  let { open, onOpenChange, collection, multiple = false, selectedIds = EMPTY_SELECTED, onConfirm, title, locale, client = contentPickerClient }:
    { open: boolean; onOpenChange: (open: boolean) => void; collection?: string; multiple?: boolean; selectedIds?: ReadonlySet<string>;
      onConfirm: (rows: PickedContentEntry[]) => void; title?: string; locale?: string; client?: ContentPickerClient } = $props();
  const id = $props.id();
  const locked = $derived(!!collection);
  let searchQuery = $state(''), debouncedSearch = $state(''), dropdownCollection = $state('');
  let picked = $state<Record<string, PickedContentEntry>>({});
  let collections = $state<{ slug: string; label: string }[]>([]), manifest = $state<PickerManifest | undefined>();
  let pages = $state.raw<FindManyResult<ContentItem>[]>([]), loading = $state(false), error = $state<unknown>();
  let fetchingNext = $state(false), searchInput = $state<HTMLInputElement | undefined>();
  const activeCollection = $derived(collection ?? dropdownCollection);
  const trimmedSearch = $derived(debouncedSearch.trim());
  const titleField = $derived(manifest?.collections[activeCollection]?.titleField);
  const dialogTitle = $derived(title ?? (multiple ? 'Add references' : 'Select content'));
  const pickedCount = $derived(Object.keys(picked).length);
  const nextCursor = $derived(pages.at(-1)?.nextCursor);

  $effect(() => { const value = searchQuery; const timer = setTimeout(() => { debouncedSearch = value; }, 300); return () => clearTimeout(timer); });
  $effect(() => { if (open && searchInput) searchInput.focus(); });
  $effect(() => {
    if (!open) return;
    const api = client, isLocked = locked, cache = pickerCache(api); let current = true;
    searchQuery = ''; picked = {}; if (!isLocked) dropdownCollection = '';
    manifest = cache.manifest;
    void api.fetchManifest().then(value => { cache.manifest = value; if (current) manifest = value; }).catch(() => {});
    if (!isLocked) {
      const knownCollections = cache.collections ?? []; collections = knownCollections; dropdownCollection = knownCollections[0]?.slug ?? '';
      void api.fetchCollections().then(value => {
        cache.collections = value; if (!current) return; collections = value;
        if (!dropdownCollection && value.length) dropdownCollection = value[0].slug;
      }).catch(() => {});
    }
    return () => { current = false; };
  });
  async function readQuery(api: ContentPickerClient, query: CachedQuery, slug: string, search: string, more = false) {
    if (query.pending) return query.pending;
    const oldPages = query.pages;
    const initialCursor = more ? oldPages.at(-1)?.nextCursor : undefined;
    if (more && initialCursor === undefined) return oldPages;
    query.error = undefined;
    query.pending = (async () => {
      const result: FindManyResult<ContentItem>[] = more ? [...oldPages] : [];
      let cursor = initialCursor;
      do {
        const page = await api.fetchContentList(slug, { limit: 50, cursor, search: search || undefined });
        result.push(page); cursor = page.nextCursor;
      } while (!more && cursor !== undefined && result.length < Math.max(1, oldPages.length));
      query.pages = result; return result;
    })();
    notifyQuery(query);
    try { return await query.pending; }
    catch (caught) { query.error = caught; throw caught; }
    finally { query.pending = undefined; notifyQuery(query); }
  }
  $effect(() => {
    if (!open || !activeCollection) { pages = []; loading = false; error = undefined; return; }
    const api = client, slug = activeCollection, search = trimmedSearch, query = pickerQuery(pickerCache(api), slug, search);
    const sync = () => { pages = query.pages; loading = !!query.pending && !query.pages.length; error = query.error; };
    query.listeners.add(sync); sync();
    void readQuery(api, query, slug, search).catch(() => {});
    return () => { query.listeners.delete(sync); };
  });
  const items = $derived.by(() => {
    const flat = pages.flatMap(page => page.items); if (!locale) return flat;
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
  async function retry() { await readQuery(client, pickerQuery(pickerCache(client), activeCollection, trimmedSearch), activeCollection, trimmedSearch).catch(() => {}); }
  async function loadMore() { fetchingNext = true; try { await readQuery(client, pickerQuery(pickerCache(client), activeCollection, trimmedSearch), activeCollection, trimmedSearch, true); } catch {} finally { fetchingNext = false; } }
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
          {#if nextCursor !== undefined}<div class="more"><button disabled={fetchingNext} onclick={loadMore}>{fetchingNext ? 'Loading...' : 'Load more'}</button></div>{/if}
        {/if}
      </div>
      <footer><button onclick={() => onOpenChange(false)}>Cancel</button>{#if multiple}<button disabled={!pickedCount} onclick={confirmMultiple}>Add selected</button>{/if}</footer>
    </div>
  </MenuDialog>
{/if}
<style>
  .picker { display:flex; flex-direction:column; height:75vh; } header,footer,.filters { display:flex; align-items:center; gap:.75rem; } header { justify-content:space-between; } h2 { margin:0; } .filters { border-block-end:1px solid #d4d4d8; padding-block:1rem; } .filters input { flex:1; min-width:0; } input,select,button { font:inherit; } input,select,button { padding:.55rem .7rem; border:1px solid #a1a1aa; border-radius:.35rem; } button { cursor:pointer; } button:disabled,.linked { cursor:default; opacity:.6; } .results { overflow-y:auto; flex:1; padding-block:1rem; } .row { display:flex; align-items:start; gap:.75rem; padding:.6rem; border-radius:.35rem; margin-block-end:.25rem; } .single { display:block; text-align:start; width:100%; border:0; background:transparent; } .row:not(.linked):hover { background:#f4f4f5; } .row input { margin-block-start:.2rem; } .meta { display:block; font-size:.875rem; color:#52525b; margin-block-start:.2rem; } .empty { text-align:center; padding-block:2rem; } .error { color:#b91c1c; } .more { text-align:center; padding-block-start:.5rem; } footer { justify-content:end; border-block-start:1px solid #d4d4d8; padding-block-start:1rem; }
</style>
