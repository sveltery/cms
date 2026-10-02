<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
  import { resolve } from '$app/paths';
  import { listSchemaCollections } from '$lib/schema.remote';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import SchemaCollections from '$lib/ui/SchemaCollections.svelte';
  const schemas = $derived(await listSchemaCollections().then(
    records => ({ records, unavailable: false }),
    () => ({ records: [], unavailable: true })
  ));
  const collections = $derived(schemas.records.map(collection => ({
    slug: collection.slug, label: collection.label, version:collection.version, updatedAt:collection.updatedAt,
    href: resolve('/schema/[collection]', { collection: collection.slug })
  })));
</script>

<svelte:head><title>Schema · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')} schemaHref={resolve('/schema')} activePage="schema">
  <SchemaCollections {collections} unavailable={schemas.unavailable} disabled={!data.canMutateSchema} />
</WorkspaceShell>
