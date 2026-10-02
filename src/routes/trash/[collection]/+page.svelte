<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { getEditorManifest, listTrashedContent } from '$lib/content.remote';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import CollectionTrash from '$lib/ui/CollectionTrash.svelte';
  let { data } = $props();

  const collection = $derived(page.params.collection ?? '');
  const manifestQuery = $derived(getEditorManifest());
  const trashQuery = $derived(listTrashedContent({ collection, limit: 50 }));
  // Await initial SSR data, then subscribe to the live query values. An async
  // helper returning a snapshot does not track later single-flight refreshes.
  const settled = $derived(await Promise.all([
    manifestQuery.catch(() => null), trashQuery.catch(() => null)
  ]));
  const content = $derived.by(() => {
    if (manifestQuery.error || trashQuery.error) return null;
    // Kit's server query .current is undefined; settled values supply SSR.
    const manifest = manifestQuery.current ?? settled[0];
    const trash = trashQuery.current ?? settled[1];
    if (!manifest || !trash) return null;
    const definition = Object.hasOwn(manifest.collections, collection) ? manifest.collections[collection] : undefined;
    return definition ? { label: definition.label, items: trash.items } : null;
  });
</script>

<svelte:head><title>{content?.label ?? 'Collection'} trash · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')}>
  <CollectionTrash {content} {collection} restoreCapability={data.restoreCapability}
    collectionHref={resolve('/content/[collection]', { collection })} />
</WorkspaceShell>
