<script lang="ts">
 import RootLayout from '../../../src/routes/+layout.svelte';
 import WorkspaceShell from '../../../src/lib/ui/WorkspaceShell.svelte';
 import ContentPickerModal from '../../../src/lib/content-picker/ContentPickerModal.svelte';
 let { state }: { state: any } = $props();
</script>
<RootLayout>
 {#each state.accounts ?? [] as client, index (client.currentUser)}
  <section data-account={index}>
   <WorkspaceShell currentUserClient={client} navigation={{ authenticated: true, permissions: [], collections: {} }} currentPath="/">Client fixture</WorkspaceShell>
  </section>
 {/each}
 {#each state.pickers ?? [] as client, index (client.fetchContentList)}
  <section data-picker={index}>
   <ContentPickerModal open={true} onOpenChange={() => {}} onConfirm={() => {}} {client} />
  </section>
 {/each}
</RootLayout>
