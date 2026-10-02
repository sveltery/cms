<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { getSchemaCollection } from '$lib/schema.remote';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import SchemaCollection from '$lib/ui/SchemaCollection.svelte';
  const definition = $derived(await getSchemaCollection(page.params.collection ?? '').then(
    value => value, () => null
  ));
</script>

<svelte:head><title>{definition?.label ?? 'Schema'} · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')} schemaHref={resolve('/schema')} activePage="schema">
  {#if definition}
    {#key definition.slug}<SchemaCollection {definition} collectionsHref={resolve('/schema')} disabled={!data.canMutateSchema} />{/key}
  {:else}
    <a href={resolve('/schema')}>Schema collections</a>
    <h1>Schema collection</h1>
    <p role="status">Schema is unavailable until authentication and storage are configured.</p>
  {/if}
</WorkspaceShell>
