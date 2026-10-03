<script lang="ts">
  import { resolve } from '$app/paths';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import Sections from '$lib/ui/sections-widgets/Sections.svelte';
  let { data } = $props();
</script>
<svelte:head><title>Sections · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')}>
  {#snippet additionalNavigation()}<a href={resolve('/sections')} aria-current="page">Sections</a>{#if data.canReadWidgets}<a href={resolve('/widgets')}>Widgets</a>{/if}{/snippet}
  <Sections canManage={data.canManageSections} />
</WorkspaceShell>
