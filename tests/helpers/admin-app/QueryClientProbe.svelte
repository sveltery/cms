<script lang="ts">
 import { untrack } from 'svelte';
 import type { QueryClient } from '@tanstack/query-core';
 import { resolveDashboardQueryClient } from '../../../src/lib/dashboard/query.svelte';
 let { onQueryClient }: { onQueryClient?: (client: QueryClient) => void } = $props();
 untrack(() => onQueryClient?.(resolveDashboardQueryClient()));
</script>
