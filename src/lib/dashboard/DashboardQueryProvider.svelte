<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import type { QueryClient } from '@tanstack/query-core';
  import { createDashboardQueryClient, provideDashboardQueryClient } from './query.svelte';
  let { children, queryClient: supplied }: { children: Snippet; queryClient?: QueryClient } = $props();
  // One stable client per application provider. Actual global Shell/route
  // composition is a separately qualified integration, not implied by this file.
  const queryClient = untrack(() => supplied ?? createDashboardQueryClient());
  provideDashboardQueryClient(queryClient);
</script>
{@render children()}
