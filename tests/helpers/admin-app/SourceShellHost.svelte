<script lang="ts">
  import WorkspaceShell from '../../../src/lib/ui/WorkspaceShell.svelte';
  import type { QueryClient } from '@tanstack/query-core';
  let { queryClient }: { queryClient: QueryClient } = $props();
</script>
<WorkspaceShell {queryClient} navigation={{ authenticated: false, permissions: [], collections: {} }} currentPath="/">
  <div>Page content</div>
</WorkspaceShell>
