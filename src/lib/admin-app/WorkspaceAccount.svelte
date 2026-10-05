<script lang="ts">
 import type { QueryClient } from '@tanstack/query-core';
 import { createDashboardClient } from '../dashboard/client';
 import { getAccountScopeResolver } from './client-scopes.svelte';
 import type { CurrentUserClient } from './current-user.svelte';
 import WorkspaceAccountView from './WorkspaceAccountView.svelte';
 let { basePath = '', queryClient, currentUserClient, siteName, toolbarLabels, toolbarLocale }: {
  basePath?: string; queryClient?: QueryClient; currentUserClient?: CurrentUserClient; siteName?: string;
  toolbarLabels?: { editMode: string; hideToolbar: string }; toolbarLocale?: string;
 } = $props();
 const resolveScope = getAccountScopeResolver();
 const scope = $derived(resolveScope(currentUserClient, queryClient));
 const client = $derived(currentUserClient ?? createDashboardClient(basePath));
</script>
{#key scope}
 <WorkspaceAccountView {scope} {client} {basePath} {siteName} {toolbarLabels} {toolbarLocale} />
{/key}
