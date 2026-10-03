<script lang="ts">
  import {resolve} from '$app/paths';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import RedirectsPanel from '$lib/ui/RedirectsPanel.svelte';
  import {createRedirectClient} from '$lib/redirects/client';
  let {data}=$props();
  const api=createRedirectClient(resolve('/api/redirects').slice(0,-'/redirects'.length));
</script>
<svelte:head><title>Redirects · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')}>
  <RedirectsPanel {api} canManage={data.canManage} />
</WorkspaceShell>
