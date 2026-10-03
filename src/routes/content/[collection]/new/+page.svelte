<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import CreateScalarContent from '$lib/ui/CreateScalarContent.svelte';
  import { getEditorManifest } from '$lib/content.remote';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  const collection = $derived(page.params.collection ?? '');
  const locale = $derived(page.url.searchParams.get('locale') ?? 'en');
  async function loadDefinition(collection: string) {
    try {
      const manifest = await getEditorManifest();
      return Object.hasOwn(manifest.collections, collection) ? manifest.collections[collection] : null;
    } catch { return null; }
  }
  const definition = $derived(await loadDefinition(collection));
</script>

<svelte:head><title>New {definition?.labelSingular ?? 'content'} · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')}>
  <a href={`${resolve('/content/[collection]', { collection })}?locale=${encodeURIComponent(locale)}`}>Collection</a>
  <h1>New {definition?.labelSingular ?? 'content'}</h1>
  {#if definition}
    {#key JSON.stringify([collection, locale])}
      <CreateScalarContent {collection} {locale} {definition} disabled={!data.canCreate} />
    {/key}
  {:else}<p role="status">Content is unavailable until authentication and storage are configured.</p>{/if}
</WorkspaceShell>
