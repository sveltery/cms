// Shared current-user query from pinned admin/src/lib/api/current-user.ts.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import type { QueryClient } from '@tanstack/query-core';
import type { CurrentUser } from '../dashboard/types';
import { observeDashboardQuery } from '../dashboard/query.svelte';
export interface CurrentUserClient {
 currentUser(): Promise<CurrentUser | null>;
 dismissWelcome?(): Promise<void>;
}
export function observeCurrentUser(queryClient: QueryClient, client: () => CurrentUserClient) {
 return observeDashboardQuery<CurrentUser | null>(queryClient, () => ({
  queryKey: ['currentUser'], queryFn: () => client().currentUser(), staleTime: 5 * 60 * 1000, retry: false
 }));
}
