<script lang="ts">
  import { onMount, untrack, type Snippet } from 'svelte';
  import type { QueryClient } from '@tanstack/query-core';
  import { createDashboardQueryClient, provideDashboardQueryClient, retainDashboardQueryClient } from './query.svelte';
  let { children, queryClient: supplied }: { children: Snippet; queryClient?: QueryClient } = $props();
  // One stable client per provider instance, including one fresh instance per
  // server render. The root layout retains it across client-side route changes.
  const queryClient = untrack(() => supplied ?? createDashboardQueryClient());
  provideDashboardQueryClient(queryClient);
  onMount(() => retainDashboardQueryClient(queryClient));
</script>
{@render children()}
