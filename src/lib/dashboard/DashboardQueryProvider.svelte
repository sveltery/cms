<script lang="ts">
  import { onMount, untrack, type Snippet } from 'svelte';
  import { provideAdminShellState } from '../admin-app/state.svelte';
  import type { QueryClient } from '@tanstack/query-core';
  import { createDashboardQueryClient, provideDashboardQueryClient, retainDashboardQueryClient } from './query.svelte';
  import { provideWelcomeDismissal } from './welcome-dismissal.svelte';
  import { createAccountScope, provideAccountScopes } from '../admin-app/client-scopes.svelte';
  let { children, queryClient: supplied }: { children: Snippet; queryClient?: QueryClient } = $props();
  // One stable client per provider instance, including one fresh instance per
  // server render. The root layout retains it across client-side route changes.
  const queryClient = untrack(() => supplied ?? createDashboardQueryClient());
  provideDashboardQueryClient(queryClient);
  // Default and explicit-client scopes use one construction policy, and all
  // default context consumers receive these exact same state/mutation owners.
  const scope = createAccountScope(queryClient);
  provideAdminShellState(scope.shellState);
  provideWelcomeDismissal(scope.dismissal);
  provideAccountScopes(scope);
  onMount(() => retainDashboardQueryClient(queryClient));
</script>
{@render children()}
