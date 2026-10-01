<script lang="ts">
  import { page } from '$app/state';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import DraftPreview from '$lib/ui/DraftPreview.svelte';
  import { getEditorManifest, getContent, updateContent, deleteContent } from '$lib/content.remote';
  async function loadContent(collection: string, id: string) {
    return Promise.all([getEditorManifest(), getContent({ collection, id })]).then(
      ([manifest, item]) => {
        const definition = Object.hasOwn(manifest.collections, collection) ? manifest.collections[collection] : undefined;
        return definition ? { definition, item } : null;
      }, () => null
    );
  }
  const content = $derived(await loadContent(page.params.collection ?? '', page.params.id ?? ''));
</script>

<svelte:head><title>{content?.item.slug ?? 'Draft'} · Sveltery CMS</title></svelte:head>
<WorkspaceShell>
  <a href={`/content/${page.params.collection}`}>Collection</a>
  <h1>Draft</h1>
  {#if content}
    <form {...updateContent}>
      <input type="hidden" name="collection" value={page.params.collection} />
      <input type="hidden" name="id" value={content.item.id} />
      <input type="hidden" name="_rev" value={content.item._rev} />
      <DraftPreview fields={Object.entries(content.definition.fields).map(([slug, field]) => ({ ...field, slug, type: field.kind === 'richText' ? 'text' : 'string', validation: field.validation ?? null }))} values={content.item.data} />
    </form>
    <form {...deleteContent}>
      <input type="hidden" name="collection" value={page.params.collection} />
      <input type="hidden" name="id" value={content.item.id} />
      <input type="hidden" name="_rev" value={content.item._rev} />
      <button disabled>Move to trash</button>
    </form>
  {:else}
    <p role="status">Content is unavailable until authentication and storage are configured.</p>
  {/if}
</WorkspaceShell>
