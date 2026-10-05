<script lang="ts">
  import type { Snippet } from 'svelte';
  import DashboardQueryProvider from '$lib/dashboard/DashboardQueryProvider.svelte';
  let { children }: { children: Snippet } = $props();
</script>
<DashboardQueryProvider>{@render children()}</DashboardQueryProvider>
