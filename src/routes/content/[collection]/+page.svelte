<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import DraftPreview from '$lib/ui/DraftPreview.svelte';
  import { previewFields } from '$lib/ui/preview-fields';
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
<WorkspaceShell homeHref={resolve('/')}>
  <a href={resolve('/')}>Collections</a>
  <h1>{content?.definition.label ?? 'Content'}</h1>
  {#if content}
    {const fields = $derived(previewFields(content.definition.fields))}
    <ul aria-label="Content drafts">
      {#each content.drafts.items as item (item.id)}
        <li><a href={resolve('/content/[collection]/[id]', { collection: item.type, id: item.id })}>{item.title ?? item.slug ?? item.id}</a></li>
      {/each}
    </ul>
    <form {...createContent}>
      <input type="hidden" name="collection" value={page.params.collection} />
      <DraftPreview {fields} />
    </form>
  {:else}
    <p role="status">Content is unavailable until authentication and storage are configured.</p>
  {/if}
</WorkspaceShell>
