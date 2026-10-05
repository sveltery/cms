<script lang="ts">
  // Shell/current-user effects ported from the pinned Source Shell.tsx.
  // Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
  import { onMount, untrack } from 'svelte';
  import type { QueryClient } from '@tanstack/query-core';
  import { createDashboardClient } from '../dashboard/client';
  import WelcomeModal from '../dashboard/WelcomeModal.svelte';
  import type { CurrentUser } from '../dashboard/types';
  import { observeDashboardQuery, resolveDashboardQueryClient, retainDashboardQueryClient } from '../dashboard/query.svelte';
  export interface CurrentUserClient {
    currentUser(): Promise<CurrentUser | null>;
    dismissWelcome?(): Promise<void>;
  }
  let { basePath = '', queryClient: supplied, currentUserClient: suppliedClient, siteName = 'Sveltery CMS', toolbarLabels = { editMode: 'Edit', hideToolbar: 'Hide toolbar' } }: {
    basePath?: string; queryClient?: QueryClient; currentUserClient?: CurrentUserClient;
    siteName?: string; toolbarLabels?: { editMode: string; hideToolbar: string };
  } = $props();
  const queryClient = untrack(() => resolveDashboardQueryClient(supplied));
  const client = $derived(suppliedClient ?? createDashboardClient(basePath));
  const currentUser = observeDashboardQuery<CurrentUser | null>(queryClient, () => ({
    queryKey: ['currentUser'], queryFn: () => client.currentUser(), staleTime: 5 * 60 * 1000, retry: false
  }));
  const user = $derived(currentUser.result.data);
  const isFirstLogin = $derived(user?.isFirstLogin);
  let welcomeModalOpen = $state(false);
  $effect(() => {
    if (isFirstLogin) welcomeModalOpen = true;
  });
  $effect(() => {
    if (!user) return;
    try {
      if (user.role >= 30) {
        localStorage.setItem('emdash-editor', '1');
        localStorage.setItem('emdash-toolbar-labels', JSON.stringify(toolbarLabels));
        localStorage.removeItem('emdash-toolbar-dismissed');
      } else {
        localStorage.removeItem('emdash-editor');
        localStorage.removeItem('emdash-toolbar-labels');
      }
    } catch { /* Optional non-secret public-toolbar hint. */ }
  });
  onMount(() => retainDashboardQueryClient(queryClient));
</script>
{#if user}
  <WelcomeModal open={welcomeModalOpen} onClose={() => welcomeModalOpen = false}
    userName={user.name} userRole={user.role} {siteName} {basePath} {queryClient}
    dismissWelcome={client.dismissWelcome} />
{/if}
