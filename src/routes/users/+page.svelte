<script lang="ts">
  import type { PageData } from './$types';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import UsersPage from '$lib/users/UsersPage.svelte';
  import { createUsersClient } from '$lib/users/client.ts';
  let {data}:{data:PageData}=$props();
  const client=$derived(createUsersClient(data.basePath));
</script>
<svelte:head><title>Users · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={`${data.basePath}/`} activePage="users"><UsersPage {client}/></WorkspaceShell>
