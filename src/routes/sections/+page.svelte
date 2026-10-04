<script lang="ts">
  import { resolve } from '$app/paths';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import Sections from '$lib/ui/sections-widgets/Sections.svelte';
  let { data } = $props();
</script>
<svelte:head><title>Sections · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')}>
  <Sections canManage={data.canManageSections} />
</WorkspaceShell>
