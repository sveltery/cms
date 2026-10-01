<script lang="ts">
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import DraftPreview from '$lib/ui/DraftPreview.svelte';
  import { listCollections, createContent } from '$lib/content.remote';
  const collections = await listCollections().then(
    (records) => ({ records, unavailable: false }),
    () => ({ records: [], unavailable: true })
  );
</script>

<svelte:head><title>Content · Sveltery CMS</title><meta name="description" content="Sveltery CMS foundation preview" /></svelte:head>
<WorkspaceShell>
  <header><p>YOUR WORKSPACE</p><h1>Content</h1></header>
  {#if collections.unavailable}
    <p role="status">Content is unavailable until authentication and storage are configured.</p>
  {:else}
    <ul aria-label="Collections">
      {#each collections.records as collection (collection.id)}
        <li><a href={`/content/${collection.slug}`}>{collection.label}</a></li>
      {/each}
    </ul>
  {/if}
  <form {...createContent}>
    <label>Collection <input name="collection" disabled /></label>
    <DraftPreview />
  </form>
</WorkspaceShell>

<style>
  header { margin-bottom: 32px; }
  header p { font-size: 12px; font-weight: 700; letter-spacing: .12em; color: #526079; }
  h1 { margin: 12px 0; font-size: 36px; letter-spacing: -.03em; }
</style>
