<script lang="ts">
  // Shell/current-user effects ported from the pinned Source Shell.tsx.
  // Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
  import { onMount, untrack } from 'svelte';
  import type { QueryClient } from '@tanstack/query-core';
  import { createDashboardClient } from '../dashboard/client';
  import { resolveAdminShellState } from './state.svelte';
  import WelcomeModal from '../dashboard/WelcomeModal.svelte';
  import { observeCurrentUser, type CurrentUserClient } from './current-user.svelte';
  import { resolveDashboardQueryClient, retainDashboardQueryClient } from '../dashboard/query.svelte';
  let { basePath = '', queryClient: supplied, currentUserClient: suppliedClient, siteName = 'Sveltery CMS', toolbarLabels = { editMode: 'Edit', hideToolbar: 'Hide toolbar' }, toolbarLocale = 'en' }: {
    basePath?: string; queryClient?: QueryClient; currentUserClient?: CurrentUserClient;
    siteName?: string; toolbarLabels?: { editMode: string; hideToolbar: string }; toolbarLocale?: string;
  } = $props();
  const queryClient = untrack(() => resolveDashboardQueryClient(supplied));
  const client = $derived(suppliedClient ?? createDashboardClient(basePath));
  const currentUser = observeCurrentUser(queryClient, () => client);
  const user = $derived(currentUser.result.data);
  const isFirstLogin = $derived(user?.isFirstLogin);
  const shellState = resolveAdminShellState();
  $effect(() => {
    const firstLogin = isFirstLogin;
    untrack(() => shellState.observeFirstLogin(firstLogin));
  });
  $effect(() => {
    if (!user) return;
    const currentUser = user, labels = toolbarLabels, locale = toolbarLocale;
    if (!untrack(() => shellState.shouldUpdateToolbar(currentUser, labels, locale))) return;
    try {
      if (user.role >= 30) {
        localStorage.setItem('emdash-editor', '1');
        localStorage.setItem('emdash-toolbar-labels', JSON.stringify(labels));
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
  <WelcomeModal open={shellState.welcomeOpen} onClose={() => shellState.closeWelcome()}
    userName={user.name} userRole={user.role} {siteName} {basePath} {queryClient}
    dismissWelcome={client.dismissWelcome} />
{/if}
