// Keep the pinned Source WelcomeModal mutation owner alive with its app shell.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import { getContext, setContext } from 'svelte';
import type { QueryClient } from '@tanstack/query-core';
import { observeDashboardMutation } from './query.svelte';

interface Dismissal {
 dismissWelcome: () => Promise<void>;
 onClose: () => void;
 onDismissed?: () => void;
}
const contextKey = Symbol('sveltery-welcome-dismissal');

export function createWelcomeDismissal(queryClient: QueryClient) {
 const mutation = observeDashboardMutation<void, Dismissal>(queryClient, () => ({
  mutationFn: dismissal => dismissal.dismissWelcome(),
  onSuccess: (_data, dismissal) => {
   queryClient.setQueryData(['currentUser'], (old: unknown) => old && typeof old === 'object' ? { ...old, isFirstLogin: false } : old);
   dismissal.onDismissed?.(); dismissal.onClose();
  },
  onError: (_error, dismissal) => { dismissal.onClose(); }
 }));
 return { queryClient, mutation };
}
type WelcomeDismissal = ReturnType<typeof createWelcomeDismissal>;
export function provideWelcomeDismissal(dismissal: WelcomeDismissal): void { setContext(contextKey, dismissal); }
export function resolveWelcomeDismissal(queryClient: QueryClient): WelcomeDismissal['mutation'] {
 const dismissal = getContext<WelcomeDismissal | undefined>(contextKey);
 // An explicit different client remains the component's standalone owner.
 return (dismissal?.queryClient === queryClient ? dismissal : createWelcomeDismissal(queryClient)).mutation;
}
