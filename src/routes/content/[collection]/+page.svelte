<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import CollectionDrafts from '$lib/ui/CollectionDrafts.svelte';
  import WritableCollection from '$lib/editor/WritableCollection.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  const collection = $derived(page.params.collection ?? '');
  const locale = $derived(page.url.searchParams.get('locale') ?? 'en');
</script>

<WorkspaceShell homeHref={resolve('/')}>
  <a href={resolve('/')}>Collections</a>
  <a href={resolve('/trash/[collection]', { collection })}>Trash</a>
  {#key JSON.stringify([collection, locale])}
    {#if data.editorCapability.create}
      <WritableCollection {collection} {locale} capability={data.editorCapability} />
    {:else}
      <CollectionDrafts {collection} />
    {/if}
  {/key}
</WorkspaceShell>
