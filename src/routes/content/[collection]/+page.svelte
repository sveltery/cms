<script lang="ts">
  import { page } from '$app/state';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import DraftPreview from '$lib/ui/DraftPreview.svelte';
  import { getEditorManifest, listContent, createContent } from '$lib/content.remote';
  async function loadContent(collection: string) {
    return Promise.all([getEditorManifest(), listContent({ collection })]).then(
      ([manifest, drafts]) => {
        const definition = Object.hasOwn(manifest.collections, collection) ? manifest.collections[collection] : undefined;
        return definition ? { definition, drafts } : null;
      }, () => null
    );
  }
  const content = $derived(await loadContent(page.params.collection ?? ''));
</script>

<svelte:head><title>{content?.definition.label ?? 'Content'} · Sveltery CMS</title></svelte:head>
<WorkspaceShell>
  <a href="/">Collections</a>
  <h1>{content?.definition.label ?? 'Content'}</h1>
  {#if content}
    <ul aria-label="Content drafts">
      {#each content.drafts.items as item (item.id)}
        <li><a href={`/content/${item.type}/${item.id}`}>{item.title ?? item.slug ?? item.id}</a></li>
      {/each}
    </ul>
    <form {...createContent}>
      <input type="hidden" name="collection" value={page.params.collection} />
      <DraftPreview fields={Object.entries(content.definition.fields).map(([slug, field]) => ({ ...field, slug, type: field.kind === 'richText' ? 'text' : 'string', validation: field.validation ?? null }))} />
    </form>
  {:else}
    <p role="status">Content is unavailable until authentication and storage are configured.</p>
  {/if}
</WorkspaceShell>
