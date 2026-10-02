<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import TrashPages from '$lib/ui/TrashPages.svelte';
  let { data } = $props();

  const collection = $derived(page.params.collection ?? '');
</script>

<WorkspaceShell homeHref={resolve('/')}>
  <!-- A collection change discards its loaded pages and row form instances. -->
  {#key collection}
    <TrashPages {collection} restoreCapability={data.restoreCapability} />
  {/key}
</WorkspaceShell>
