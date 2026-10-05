<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import ContentTypeList from '$lib/schema-admin/ContentTypeList.svelte';
  import { adminClient } from '$lib/schema-admin/runtime-client';
  import type { Collection } from '$lib/server/database/contract';
  let { data } = $props();
  let collections = $state<Collection[]>([]), loading = $state(true), error = $state('');
  async function refresh() { try { collections = await adminClient.listCollections(); error=''; } catch(cause) { error=cause instanceof Error ? cause.message : 'Schema unavailable'; } finally { loading=false; } }
  async function mutate(run:()=>Promise<unknown>) { try { await run(); await refresh(); } catch(cause) { error=cause instanceof Error ? cause.message : 'Schema could not be saved'; throw cause; } }
  onMount(refresh);
</script>
<svelte:head><title>Content Types · Sveltery CMS</title></svelte:head>
<a href={resolve('/schema')}>Schema overview</a>
{#if error}<p role="alert">{error}</p>{/if}
<ContentTypeList disabled={!data.canMutateSchema} deletionAvailable={false} {collections} isLoading={loading} basePath={resolve('/schema/_manage')}
  onDelete={data.canMutateSchema ? (slug:string)=>mutate(()=>adminClient.deleteCollection(slug)) : undefined}
  onReorder={data.canMutateSchema ? (slugs:string[])=>mutate(()=>adminClient.reorderCollections(slugs)) : undefined} />
