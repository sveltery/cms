<script lang="ts">
  import Dashboard from '../../../src/lib/dashboard/Dashboard.svelte';
  let { state }: { state: { manifest: { collections: Record<string, { label: string }> }; user?: { role: number }; client?: { fetchDashboardStats(): Promise<any>; fetchTransferCapabilities(): Promise<any>; dismissScheduledPolicyRejection(collection: string, id: string, revision: string): Promise<void> }; basePath?: string } } = $props();
</script>
<Dashboard {...state} />
