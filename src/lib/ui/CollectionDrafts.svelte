<script lang="ts">
  import { resolve } from '$app/paths';
  import { getEditorManifest, listContent, createContent } from '$lib/content.remote';
  import DraftPreview from './DraftPreview.svelte';
  import { previewFields } from './preview-fields';

  const { collection }: { collection: string } = $props();
  let cursor = $state<string | undefined>();
  async function loadContent(collection: string, cursor?: string) {
    try {
      const [manifest, drafts] = await Promise.all([
        getEditorManifest(), listContent({ collection, ...(cursor ? { cursor } : {}) })
      ]);
      const definition = Object.hasOwn(manifest.collections, collection) ? manifest.collections[collection] : undefined;
      return definition ? { definition, drafts } : null;
    } catch { return null; }
  }
  const content = $derived(await loadContent(collection, cursor));
</script>

<svelte:head><title>{content?.definition.label ?? 'Content'} · Sveltery CMS</title></svelte:head>
<h1>{content?.definition.label ?? 'Content'}</h1>
{#if content}
  {const fields = $derived(previewFields(content.definition.fields))}
  <ul aria-label="Content drafts">
    {#each content.drafts.items as item (item.id)}
      <li><a href={resolve('/content/[collection]/[id]', { collection: item.type, id: item.id })}>{item.title ?? item.slug ?? item.id}</a></li>
    {/each}
  </ul>
  {#if content.drafts.items.length === 0}
    <p role="status">{cursor ? 'No more drafts.' : 'No drafts in this collection.'}</p>
  {:else if !content.drafts.nextCursor}
    <p role="status">No more drafts.</p>
  {/if}
  {#if cursor || content.drafts.nextCursor}
    <nav aria-label="Draft pages">
      {#if cursor}<button type="button" onclick={() => { cursor = undefined; }}>First page</button>{/if}
      {#if content.drafts.nextCursor}
        <button type="button" onclick={() => { cursor = content?.drafts.nextCursor; }}>Next drafts</button>
      {/if}
    </nav>
  {/if}
  <form {...createContent}>
    <input type="hidden" name="collection" value={collection} />
    <DraftPreview {fields} />
  </form>
{:else}
  <p role="status">Content is unavailable until authentication and storage are configured.</p>
{/if}
