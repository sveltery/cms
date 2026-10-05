<script lang="ts">
  import { onMount, untrack, type Snippet } from 'svelte';
  import { createAdminShellState, provideAdminShellState } from '../admin-app/state.svelte';
  import type { QueryClient } from '@tanstack/query-core';
  import { createDashboardQueryClient, provideDashboardQueryClient, retainDashboardQueryClient } from './query.svelte';
  import { createWelcomeDismissal, provideWelcomeDismissal } from './welcome-dismissal.svelte';
  import { provideAccountScopes } from '../admin-app/client-scopes.svelte';
  let { children, queryClient: supplied }: { children: Snippet; queryClient?: QueryClient } = $props();
  // One stable client per provider instance, including one fresh instance per
  // server render. The root layout retains it across client-side route changes.
  const queryClient = untrack(() => supplied ?? createDashboardQueryClient());
  provideDashboardQueryClient(queryClient);
  const shellState = createAdminShellState();
  const dismissal = createWelcomeDismissal(queryClient);
  provideAdminShellState(shellState);
  provideWelcomeDismissal(dismissal);
  provideAccountScopes({ queryClient, shellState, dismissal });
  onMount(() => retainDashboardQueryClient(queryClient));
</script>
{@render children()}
