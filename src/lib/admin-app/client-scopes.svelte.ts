// Keep explicit API clients isolated within one actual application provider.
// Default consumers retain the root cache and pinned Source query keys/policy.
import { getContext, setContext } from 'svelte';
import type { QueryClient } from '@tanstack/query-core';
import { createDashboardQueryClient, resolveDashboardQueryClient, getDashboardClientQueryClientResolver } from '../dashboard/query.svelte';
import { createWelcomeDismissal } from '../dashboard/welcome-dismissal.svelte';
import { createAdminShellState, resolveAdminShellState } from './state.svelte';
import type { CurrentUserClient } from './current-user.svelte';
export function createAccountScope(queryClient = createDashboardQueryClient(), shellState = createAdminShellState()) {
 return { queryClient, shellState, dismissal: createWelcomeDismissal(queryClient) };
}
export type AccountScope = ReturnType<typeof createAccountScope>;
const contextKey = Symbol('sveltery-admin-client-scopes');
function createScopeResolver(root: AccountScope, resolveClientCache?: (identity: object) => QueryClient) {
 const clients = new WeakMap<CurrentUserClient, AccountScope>();
 const caches = new WeakMap<QueryClient, AccountScope>([[root.queryClient, root]]);
 function forCache(queryClient: QueryClient): AccountScope {
  let scope = caches.get(queryClient);
  if (!scope) { scope = createAccountScope(queryClient); caches.set(queryClient, scope); }
  return scope;
 }
 function resolve(client?: CurrentUserClient, supplied?: QueryClient): AccountScope {
  if (supplied) return forCache(supplied);
  if (!client) return root;
  let scope = clients.get(client);
  if (!scope) { scope = forCache(resolveClientCache?.(client) ?? createDashboardQueryClient()); clients.set(client, scope); }
  return scope;
 }
 return resolve;
}
export function provideAccountScopes(root: AccountScope) {
 setContext(contextKey, createScopeResolver(root, getDashboardClientQueryClientResolver()));
}
export function getAccountScopeResolver() {
 const resolver = getContext<((client?: CurrentUserClient, supplied?: QueryClient) => AccountScope) | undefined>(contextKey);
 if (resolver) return resolver;
 const fallback = createAccountScope(resolveDashboardQueryClient(), resolveAdminShellState());
 return createScopeResolver(fallback);
}
