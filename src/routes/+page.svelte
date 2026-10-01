<script lang="ts">
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import DraftPreview from '$lib/ui/DraftPreview.svelte';
</script>

<svelte:head><title>Content · Sveltery CMS</title><meta name="description" content="Sveltery CMS foundation preview" /></svelte:head>

<WorkspaceShell>
  <header><p>YOUR WORKSPACE</p><h1>Content</h1></header>
  <DraftPreview />
</WorkspaceShell>

<style>
  header { margin-bottom: 32px; }
  header p { font-size: 12px; font-weight: 700; letter-spacing: .12em; color: #526079; }
  h1 { margin: 12px 0; font-size: 36px; letter-spacing: -.03em; }
</style>
