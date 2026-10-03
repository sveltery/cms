<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import CollectionDrafts from '$lib/ui/CollectionDrafts.svelte';
  import ScalarContentList from '$lib/ui/ScalarContentList.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<WorkspaceShell homeHref={resolve('/')}>
  <a href={resolve('/')}>Collections</a>
  <a href={resolve('/trash/[collection]', { collection: page.params.collection ?? '' })}>Trash</a>
  {#key page.params.collection}
    {#if data.configuredEditor}
      <ScalarContentList collection={page.params.collection ?? ''} locale={page.url.searchParams.get('locale') ?? 'en'} canCreate={data.canCreate} />
    {:else}<CollectionDrafts collection={page.params.collection ?? ''} />{/if}
  {/key}
</WorkspaceShell>
