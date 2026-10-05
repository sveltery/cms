// Keep the pinned Source WelcomeModal mutation owner alive with its app shell.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import { getContext, setContext } from 'svelte';
import { MutationObserver, notifyManager, type QueryClient } from '@tanstack/query-core';

interface Dismissal {
 dismissWelcome: () => Promise<void>;
 onClose: () => void;
 onDismissed?: () => void;
}
const contextKey = Symbol('sveltery-welcome-dismissal');

export function createWelcomeDismissal(queryClient: QueryClient) {
 const observer = new MutationObserver<void, Error, Dismissal>(queryClient, {
  mutationFn: dismissal => dismissal.dismissWelcome(),
  onSuccess: (_data, dismissal) => {
   queryClient.setQueryData(['currentUser'], (old: unknown) => old && typeof old === 'object' ? { ...old, isFirstLogin: false } : old);
   dismissal.onDismissed?.(); dismissal.onClose();
  },
  onError: (_error, dismissal) => { dismissal.onClose(); }
 });
 return { queryClient, observer };
}
export type WelcomeDismissal = ReturnType<typeof createWelcomeDismissal>;
export function provideWelcomeDismissal(dismissal: WelcomeDismissal): void { setContext(contextKey, dismissal); }
export function resolveWelcomeDismissal(queryClient: QueryClient, supplied?: WelcomeDismissal) {
 const dismissal = getContext<WelcomeDismissal | undefined>(contextKey);
 const owner = supplied ?? (dismissal?.queryClient === queryClient ? dismissal : createWelcomeDismissal(queryClient));
 const observer = owner.observer;
 let result = $state.raw(observer.getCurrentResult());
 // The owner persists at the provider. Each mounted consumer subscribes to the
 // real current mutation, including a pending mutation started before remount.
 $effect(() => {
  const unsubscribe = observer.subscribe(notifyManager.batchCalls(next => { result = next; }));
  result = observer.getCurrentResult(); return unsubscribe;
 });
 return { get result() { return result; }, mutate: (variables: Dismissal) => {
  const promise = observer.mutate(variables); result = observer.getCurrentResult(); return promise;
 } };
}
