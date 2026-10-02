<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { getEditorManifest, listTrashedContent } from '$lib/content.remote';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import CollectionTrash from '$lib/ui/CollectionTrash.svelte';

  const collection = $derived(page.params.collection ?? '');
  async function loadTrash(collection: string) {
    try {
      const [manifest, trash] = await Promise.all([
        getEditorManifest(), listTrashedContent({ collection, limit: 50 })
      ]);
      const definition = Object.hasOwn(manifest.collections, collection) ? manifest.collections[collection] : undefined;
      return definition ? { label: definition.label, items: trash.items } : null;
    } catch { return null; }
  }
  const content = $derived(await loadTrash(collection));
</script>

<svelte:head><title>{content?.label ?? 'Collection'} trash · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')}>
  <CollectionTrash {content} collectionHref={resolve('/content/[collection]', { collection })} />
</WorkspaceShell>
