<script lang="ts">
 import { untrack } from 'svelte';
 import type { QueryClient } from '@tanstack/query-core';
 import { getAccountScopeResolver } from '../../../src/lib/admin-app/client-scopes.svelte';
 import type { CurrentUserClient } from '../../../src/lib/admin-app/current-user.svelte';
 let { onQueryClient, currentUserClient }: { onQueryClient?: (client: QueryClient) => void; currentUserClient?: CurrentUserClient } = $props();
 const resolveScope = getAccountScopeResolver();
 untrack(() => onQueryClient?.(resolveScope(currentUserClient).queryClient));
</script>
