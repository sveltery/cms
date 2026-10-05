// Native Svelte observers for the pinned EmDash React Query contracts.
// EmDash portions Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Actual @tanstack/query-core5.90.20 is reused; its complete Tanner Linsley
// license is preserved separately in notices/tanstack-query-core-MIT.txt.
import { getContext, setContext, untrack } from 'svelte';
import {
  QueryClient, QueryObserver, MutationObserver, focusManager, notifyManager,
  type QueryObserverOptions, type QueryObserverResult,
  type MutationObserverOptions, type MutationObserverResult
} from '@tanstack/query-core';

const contextKey = Symbol('sveltery-dashboard-query-client');
const focusedClients = new WeakMap<QueryClient, { count: number; remove: () => void }>();

export function createDashboardQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } });
}
export function provideDashboardQueryClient(client: QueryClient): void { setContext(contextKey, client); }
export function getDashboardQueryClient(): QueryClient | undefined {
  return getContext<QueryClient | undefined>(contextKey);
}
export function resolveDashboardQueryClient(supplied?: QueryClient): QueryClient {
  return supplied ?? getDashboardQueryClient() ?? createDashboardQueryClient();
}

// The QueryClient belongs to one app/provider. Components retain that stable
// client while mounted; there is no process-global cache of users or responses.
export function retainDashboardQueryClient(client: QueryClient): () => void {
  client.mount();
  let focus = focusedClients.get(client);
  if (!focus) {
    // Source query-core listens to visibilitychange. Native window focus is an
    // additional event adaptation with the same freshness/deduplication rules.
    const listener = () => {
      if (focusManager.isFocused()) {
        void client.resumePausedMutations().then(() => client.getQueryCache().onFocus());
      }
    };
    window.addEventListener('focus', listener);
    focus = { count: 0, remove: () => window.removeEventListener('focus', listener) };
    focusedClients.set(client, focus);
  }
  focus.count++;
  return () => {
    client.unmount();
    if (--focus.count === 0) { focus.remove(); focusedClients.delete(client); }
  };
}

// Both native observers use the core notification scheduler and publish their
// current result after subscribing. Query observers additionally refresh their
// optimistic result at that exact point; mutation observers need no refresh.
function subscribeObserver<Result>(observer: {
  subscribe: (listener: (result: Result) => void) => () => void;
  getCurrentResult: () => Result;
}, publish: (result: Result) => void, afterSubscribe?: () => void): () => void {
  const unsubscribe = observer.subscribe(notifyManager.batchCalls(publish));
  afterSubscribe?.();
  publish(observer.getCurrentResult());
  return unsubscribe;
}

export function observeDashboardQuery<T>(client: QueryClient, options: () => QueryObserverOptions<T, Error>) {
  const defaults = () => client.defaultQueryOptions({ ...options(), _optimisticResults: 'optimistic' });
  const initial = untrack(defaults);
  const observer = new QueryObserver<T, Error>(client, initial);
  let result = $state.raw<QueryObserverResult<T, Error>>(observer.getOptimisticResult(initial));
  $effect(() => { const next = defaults(); untrack(() => observer.setOptions(next)); });
  $effect(() => subscribeObserver(observer, next => { result = next; }, () => observer.updateResult()));
  return { get result() { return result; } };
}

export function observeDashboardMutation<T, Variables>(client: QueryClient, options: () => MutationObserverOptions<T, Error, Variables>) {
  const observer = new MutationObserver<T, Error, Variables>(client, untrack(options));
  let result = $state.raw<MutationObserverResult<T, Error, Variables>>(observer.getCurrentResult());
  $effect(() => { const next = options(); untrack(() => observer.setOptions(next)); });
  $effect(() => subscribeObserver(observer, next => { result = next; }));
  return { get result() { return result; }, mutate: (variables: Variables) => {
    const promise = observer.mutate(variables);
    // Svelte tick observes pending immediately; later core notifications retain
    // the actual default scheduler. This changes no retry/cache/HTTP contract.
    result = observer.getCurrentResult(); return promise;
  } };
}
