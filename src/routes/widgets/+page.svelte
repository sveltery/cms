<script lang="ts">
  import { resolve } from '$app/paths';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import Widgets from '$lib/ui/sections-widgets/Widgets.svelte';
  let { data } = $props();
</script>
<svelte:head><title>Widgets · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')}>
  {#snippet additionalNavigation()}{#if data.canReadSections}<a href={resolve('/sections')}>Sections</a>{/if}<a href={resolve('/widgets')} aria-current="page">Widgets</a>{/snippet}
  <Widgets canManage={data.canManageWidgets} />
</WorkspaceShell>
