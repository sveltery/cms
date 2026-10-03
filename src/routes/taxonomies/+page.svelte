<script lang="ts">
 import {resolve} from '$app/paths';
 import {listTaxonomyDefinitions,listTaxonomyCollections} from '$lib/taxonomies.remote';
 import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
 import CreateTaxonomyDefinition from '$lib/ui/CreateTaxonomyDefinition.svelte';
 import type {PageProps} from './$types';
 let {data}:PageProps=$props();
 const state=$derived(await Promise.all([listTaxonomyDefinitions({}),data.canManageTaxonomies?listTaxonomyCollections():Promise.resolve([])]).then(([definitions,collections])=>({definitions:definitions.taxonomies,collections,unavailable:false}),()=>({definitions:[],collections:[],unavailable:true})));
</script>
<svelte:head><title>Taxonomies · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')} activePage="taxonomies">
 <h1>Taxonomies</h1>
 {#if state.unavailable}<p role="status">Taxonomies are unavailable until authentication and storage are configured.</p>
 {:else}<ul aria-label="Taxonomies">{#each state.definitions as definition (definition.id)}<li><a href={resolve('/taxonomies/[taxonomy]',{taxonomy:definition.name})+`?locale=${encodeURIComponent(definition.locale)}`}>{definition.label}</a> <span>{definition.locale}</span></li>{/each}</ul>{/if}
 <CreateTaxonomyDefinition collections={state.collections} definitions={state.definitions} disabled={!data.canManageTaxonomies}/>
</WorkspaceShell>
