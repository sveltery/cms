<script lang="ts">
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import DraftPreview from '$lib/ui/DraftPreview.svelte';
  import { listContent, createContent } from '$lib/content.remote';

  const content = await listContent().then(
    (records) => ({ records, unavailable: false }),
    () => ({ records: [], unavailable: true })
  );
</script>

<svelte:head><title>Content · Sveltery CMS</title><meta name="description" content="Sveltery CMS foundation preview" /></svelte:head>

<WorkspaceShell>
  <header><p>YOUR WORKSPACE</p><h1>Content</h1></header>
  {#if content.unavailable}
    <p role="status">Content is unavailable until authentication and storage are configured.</p>
  {:else}
    <ul aria-label="Content drafts">
      {#each content.records as record (record.id)}
        <li>{record.title}</li>
      {/each}
    </ul>
  {/if}
  <form {...createContent}>
    <DraftPreview />
  </form>
</WorkspaceShell>

<style>
  header { margin-bottom: 32px; }
  header p { font-size: 12px; font-weight: 700; letter-spacing: .12em; color: #526079; }
  h1 { margin: 12px 0; font-size: 36px; letter-spacing: -.03em; }
</style>
