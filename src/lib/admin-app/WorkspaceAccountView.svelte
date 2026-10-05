<script lang="ts">
  // Shell/current-user effects ported from the pinned Source Shell.tsx.
  // Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
  import { onMount, untrack } from 'svelte';
  import type { AccountScope } from './client-scopes.svelte';
  import WelcomeModal from '../dashboard/WelcomeModal.svelte';
  import { observeCurrentUser, type CurrentUserClient } from './current-user.svelte';
  import { retainDashboardQueryClient } from '../dashboard/query.svelte';
  let { scope, client, basePath = '', siteName = 'Sveltery CMS', toolbarLabels = { editMode: 'Edit', hideToolbar: 'Hide toolbar' }, toolbarLocale = 'en' }: {
    scope: AccountScope; client: CurrentUserClient; basePath?: string;
    siteName?: string; toolbarLabels?: { editMode: string; hideToolbar: string }; toolbarLocale?: string;
  } = $props();
  const queryClient = untrack(() => scope.queryClient);
  const currentUser = observeCurrentUser(queryClient, () => client);
  const user = $derived(currentUser.result.data);
  const isFirstLogin = $derived(user?.isFirstLogin);
  const shellState = untrack(() => scope.shellState);
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
    dismissWelcome={client.dismissWelcome} dismissalOwner={scope.dismissal} />
{/if}
