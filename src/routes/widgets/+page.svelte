<script lang="ts">
  import { resolve } from '$app/paths';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import Widgets from '$lib/ui/sections-widgets/Widgets.svelte';
  let { data } = $props();
</script>
<svelte:head><title>Widgets · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')}>
  <Widgets canManage={data.canManageWidgets} />
</WorkspaceShell>
