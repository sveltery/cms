<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import CollectionDrafts from '$lib/ui/CollectionDrafts.svelte';
</script>

<WorkspaceShell homeHref={resolve('/')}>
  <a href={resolve('/')}>Collections</a>
  <a href={resolve('/trash/[collection]', { collection: page.params.collection ?? '' })}>Trash</a>
  {#key page.params.collection}
    <CollectionDrafts collection={page.params.collection ?? ''} />
  {/key}
</WorkspaceShell>
