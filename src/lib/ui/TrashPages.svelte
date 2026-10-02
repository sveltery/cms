<script lang="ts">
  import { resolve } from '$app/paths';
  import { getEditorManifest, listTrashedContent } from '$lib/content.remote';
  import CollectionTrash from './CollectionTrash.svelte';
  let { collection, restoreCapability }: {
    collection: string;
    restoreCapability: { any: boolean; own: boolean; actorId: string | null };
  } = $props();

  let cursors = $state<(string | undefined)[]>([undefined]);
  let loading = $state(false);
  let loadFailed = $state(false);
  const manifestQuery = $derived(getEditorManifest());
  const pages = $derived(cursors.map(cursor => {
    const args = { collection, limit: 50, ...(cursor === undefined ? {} : { cursor }) };
    return { args, live: listTrashedContent(args) };
  }));
  // Await initial SSR data, then retain and read each live native query instance.
  const settled = $derived(await Promise.all([
    manifestQuery.catch(() => null), ...pages.map(({ live }) => live.catch(() => null))
  ]));
  const content = $derived.by(() => {
    if (manifestQuery.error || pages.some(({ live }) => live.error)) return null;
    const manifest = manifestQuery.current ?? settled[0] as Awaited<typeof manifestQuery> | null;
    if (!manifest) return null;
    const definition = Object.hasOwn(manifest.collections, collection) ? manifest.collections[collection] : undefined;
    if (!definition) return null;
    const items = [];
    const seen = new Set<string>();
    let nextCursor: string | undefined;
    for (const [index, { args, live }] of pages.entries()) {
      // Server .current is undefined; settled values supply initial SSR only.
      const result = live.current ?? settled[index + 1] as Awaited<ReturnType<typeof listTrashedContent>> | null;
      if (!result) return null;
      for (const item of result.items) {
        const key = JSON.stringify([item.id, item.locale]);
        // Independent Kit page refreshes can overlap a previous boundary.
        if (!seen.has(key)) { items.push({ ...item, queryArgs: args }); seen.add(key); }
      }
      nextCursor = result.nextCursor;
    }
    return { label: definition.label, items, nextCursor };
  });
  async function loadMore() {
    const cursor = content?.nextCursor;
    if (loading || !cursor) return;
    loading = true;
    loadFailed = false;
    try {
      // Resolve before appending so a failed continuation keeps the visible rows.
      await listTrashedContent({ collection, limit: 50, cursor });
      cursors = [...cursors, cursor];
    } catch { loadFailed = true; }
    finally { loading = false; }
  }
</script>

<svelte:head><title>{content?.label ?? 'Collection'} trash · Sveltery CMS</title></svelte:head>
<CollectionTrash {content} {collection} {restoreCapability} {loading} {loadFailed} onLoadMore={loadMore}
  collectionHref={resolve('/content/[collection]', { collection })} />
