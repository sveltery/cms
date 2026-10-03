<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import SectionEditor from '$lib/ui/sections-widgets/SectionEditor.svelte';
  let { data } = $props();
</script>
<svelte:head><title>Edit section · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')}>
  {#snippet additionalNavigation()}<a href={resolve('/sections')} aria-current="page">Sections</a>{#if data.canReadWidgets}<a href={resolve('/widgets')}>Widgets</a>{/if}{/snippet}
  <SectionEditor slug={page.params.slug ?? ''} canManage={data.canManageSections} />
</WorkspaceShell>
