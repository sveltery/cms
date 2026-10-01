<script lang="ts">
  import { page } from '$app/state';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import DraftPreview from '$lib/ui/DraftPreview.svelte';
  import { getCollection, listContent, createContent } from '$lib/content.remote';
  const content = $derived(await Promise.all([
    getCollection(page.params.collection ?? ''),
    listContent({ collection: page.params.collection ?? '' })
  ]).then(([definition, drafts]) => ({ definition, drafts }), () => null));
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
      <input type="hidden" name="collection" value={content.definition.slug} />
      <DraftPreview fields={content.definition.fields} />
    </form>
  {:else}
    <p role="status">Content is unavailable until authentication and storage are configured.</p>
  {/if}
</WorkspaceShell>
