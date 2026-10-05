<script lang="ts">
  import DashboardQueryProvider from '../../../src/lib/dashboard/DashboardQueryProvider.svelte';
  import WorkspaceShell from '../../../src/lib/ui/WorkspaceShell.svelte';
  import type { QueryClient } from '@tanstack/query-core';
  let { state, queryClient }: { state: any; queryClient?: QueryClient } = $props();
</script>
<DashboardQueryProvider {queryClient}>
  <WorkspaceShell {...state} navigation={{ authenticated: true, permissions: [], collections: {} }} currentPath="/">
    <div>Native fixture page</div>
  </WorkspaceShell>
</DashboardQueryProvider>
