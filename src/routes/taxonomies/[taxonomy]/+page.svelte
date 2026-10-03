<script lang="ts">
 import {page} from '$app/state';import {resolve} from '$app/paths';
 import {getTaxonomyDefinition,listTaxonomyTerms,listTaxonomyCollections} from '$lib/taxonomies.remote';
 import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
 import TaxonomyDefinitionEditor from '$lib/ui/TaxonomyDefinitionEditor.svelte';
 import TaxonomyTermTree from '$lib/ui/TaxonomyTermTree.svelte';
 import CreateTaxonomyTerm from '$lib/ui/CreateTaxonomyTerm.svelte';
 import TaxonomyBulkTag from '$lib/ui/TaxonomyBulkTag.svelte';
 import type {TermWithCount} from '$lib/server/taxonomies/upstream/api/handlers/taxonomies';
 import type {PageProps} from './$types';let {data}:PageProps=$props();
 const taxonomy=$derived(page.params.taxonomy??''),locale=$derived(page.url.searchParams.get('locale')??'en');
 const state=$derived(await Promise.all([getTaxonomyDefinition({taxonomy,locale}),listTaxonomyTerms({taxonomy,locale}),data.canManageTaxonomies?listTaxonomyCollections():Promise.resolve([])]).then(([definition,terms,collections])=>({definition:definition.taxonomy,terms:terms.terms,collections}),()=>null));
 function flatten(terms:TermWithCount[]):TermWithCount[]{return terms.flatMap(term=>[term,...flatten(term.children)]);}
 const parents=$derived(state?flatten(state.terms):[]);
</script>
<svelte:head><title>{state?.definition.label??'Taxonomy'} · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')} activePage="taxonomies"><a href={resolve('/taxonomies')}>Taxonomies</a>
 {#if state}<h1>{state.definition.label}</h1>
  <form method="get"><label>Locale <input name="locale" value={locale}/></label><button>View locale</button></form>
  <TaxonomyDefinitionEditor definition={state.definition} collections={state.collections} disabled={!data.canManageTaxonomies}/>
  <TaxonomyTermTree {taxonomy} terms={state.terms} {parents} {locale} labelSingular={state.definition.labelSingular??'Term'} disabled={!data.canManageTaxonomies}/>
  {#if !state.terms.length}<p>No terms yet.</p>{/if}
  <CreateTaxonomyTerm {taxonomy} {locale} terms={parents} disabled={!data.canManageTaxonomies}/>
  <TaxonomyBulkTag terms={parents} disabled={!data.canManageTaxonomies}/>
 {:else}<h1>Taxonomy</h1><p role="status">Taxonomy is unavailable.</p>{/if}
</WorkspaceShell>
