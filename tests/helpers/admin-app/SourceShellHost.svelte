<script lang="ts">
  import WorkspaceShell from '../../../src/lib/ui/WorkspaceShell.svelte';
  import type { Snippet } from 'svelte';
  import type { CurrentUserClient } from '../../../src/lib/admin-app/current-user.svelte';
  import type { QueryClient } from '@tanstack/query-core';
  let { queryClient, content, currentUserClient }: { queryClient: QueryClient; content: Snippet; currentUserClient: CurrentUserClient } = $props();
</script>
<WorkspaceShell {queryClient} {currentUserClient} navigation={{ authenticated: false, permissions: [], collections: {} }} currentPath="/">
  {@render content()}
</WorkspaceShell>
