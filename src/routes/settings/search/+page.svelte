<script lang="ts">
 import {resolve} from '$app/paths';
 import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
 import SearchIndexControls from '$lib/ui/SearchIndexControls.svelte';
 import type {PageData} from './$types';
 let {data}:{data:PageData}=$props();
</script>
<svelte:head><title>Search indexes · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')}><header><h1>Search indexes</h1><p>Choose searchable fields in your collection schema, then enable or rebuild their indexes.</p></header><SearchIndexControls collections={data.collections} mutationsEnabled={data.mutationsEnabled}/></WorkspaceShell>
