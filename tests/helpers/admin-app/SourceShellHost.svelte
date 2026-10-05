<script lang="ts">
  import WorkspaceShell from '../../../src/lib/ui/WorkspaceShell.svelte';
  import type { Snippet } from 'svelte';
  import type { QueryClient } from '@tanstack/query-core';
  let { queryClient, content }: { queryClient: QueryClient; content: Snippet } = $props();
</script>
<WorkspaceShell {queryClient} navigation={{ authenticated: false, permissions: [], collections: {} }} currentPath="/">
  {@render content()}
</WorkspaceShell>
