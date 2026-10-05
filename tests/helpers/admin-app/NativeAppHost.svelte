<script lang="ts">
  import RootLayout from '../../../src/routes/+layout.svelte';
  import ContentPickerModal from '../../../src/lib/content-picker/ContentPickerModal.svelte';
  import QueryClientProbe from './QueryClientProbe.svelte';
  import WorkspaceShell from '../../../src/lib/ui/WorkspaceShell.svelte';
  import type { QueryClient } from '@tanstack/query-core';
  let { state, queryClient, onQueryClient }: { state: any; queryClient?: QueryClient; onQueryClient?: (client: QueryClient) => void } = $props();
</script>
<RootLayout>
  <QueryClientProbe {onQueryClient} />
  <WorkspaceShell {queryClient} {...state} navigation={{ authenticated: true, permissions: [], collections: {} }} currentPath="/">
    <div>Native fixture page</div>
  </WorkspaceShell>
  {#if state.showSecond}
   <WorkspaceShell {queryClient} {...state} navigation={{ authenticated: true, permissions: [], collections: {} }} currentPath="/">Second current-user consumer</WorkspaceShell>
  {/if}
  {#if state.pickerClient}
   <ContentPickerModal open={false} onOpenChange={() => {}} onConfirm={() => {}} client={state.pickerClient} />
  {/if}
</RootLayout>
