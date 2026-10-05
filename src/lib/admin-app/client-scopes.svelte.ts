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
 const clients = new WeakMap<CurrentUserClient['currentUser'], AccountScope>();
 const caches = new WeakMap<QueryClient, AccountScope>([[root.queryClient, root]]);
 function resolve(client?: CurrentUserClient, supplied?: QueryClient): AccountScope {
  if (supplied) {
   let scope = caches.get(supplied);
   if (!scope) { scope = createAccountScope(supplied); caches.set(supplied, scope); }
   return scope;
  }
  if (!client) return root;
  let scope = clients.get(client.currentUser);
  if (!scope) { scope = createAccountScope(resolveClientCache?.(client.currentUser)); clients.set(client.currentUser, scope); }
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
