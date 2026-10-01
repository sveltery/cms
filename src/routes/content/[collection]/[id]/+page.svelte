<script lang="ts">
  import { page } from '$app/state';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import DraftPreview from '$lib/ui/DraftPreview.svelte';
  import { getCollection, getContent, updateContent, deleteContent } from '$lib/content.remote';
  const content = $derived(await Promise.all([
    getCollection(page.params.collection ?? ''),
    getContent({ collection: page.params.collection ?? '', id: page.params.id ?? '' })
  ]).then(([definition, item]) => ({ definition, item }), () => null));
</script>

<svelte:head><title>{content?.item.slug ?? 'Draft'} · Sveltery CMS</title></svelte:head>
<WorkspaceShell>
  <a href={`/content/${page.params.collection}`}>Collection</a>
  <h1>Draft</h1>
  {#if content}
    <form {...updateContent}>
      <input type="hidden" name="collection" value={content.definition.slug} />
      <input type="hidden" name="id" value={content.item.id} />
      <input type="hidden" name="_rev" value={content.item._rev} />
      <DraftPreview fields={content.definition.fields} values={content.item.data} />
    </form>
    <form {...deleteContent}>
      <input type="hidden" name="collection" value={content.definition.slug} />
      <input type="hidden" name="id" value={content.item.id} />
      <input type="hidden" name="_rev" value={content.item._rev} />
      <button disabled>Move to trash</button>
    </form>
  {:else}
    <p role="status">Content is unavailable until authentication and storage are configured.</p>
  {/if}
</WorkspaceShell>
