<script lang="ts">
 import {tick} from 'svelte';
 import {reorderTaxonomyTerms,listTaxonomyTerms} from '$lib/taxonomies.remote';
 import TaxonomyTermTree from './TaxonomyTermTree.svelte';
 import TaxonomyTermCard from './TaxonomyTermCard.svelte';
 import type {TermWithCount} from '$lib/server/taxonomies/upstream/api/handlers/taxonomies';
 let {taxonomy,terms,parents,locale,labelSingular,disabled,parentId=''}:{taxonomy:string;terms:TermWithCount[];parents:TermWithCount[];locale:string;labelSingular:string;disabled:boolean;parentId?:string}=$props();
 const form=$derived(reorderTaxonomyTerms.for(JSON.stringify([taxonomy,parentId])));let ids=$state<string[]>([]),message=$state<string|undefined>();
 async function move(index:number,direction:number){const next=[...terms];[next[index],next[index+direction]]=[next[index+direction],next[index]];ids=next.map(term=>term.translationGroup??term.id);try{await tick();await form.submit();await listTaxonomyTerms({taxonomy,locale}).refresh();}catch{message='Order could not be saved.';}}
</script>
<ul>{#each terms as term,index (term.id)}<li><TaxonomyTermCard {taxonomy} {term} {parents} {locale} {labelSingular} {disabled}/>
 <button type="button" aria-label={`Move ${term.label} up`} disabled={disabled||index===0||form.pending>0} onclick={()=>move(index,-1)}>↑</button>
 <button type="button" aria-label={`Move ${term.label} down`} disabled={disabled||index===terms.length-1||form.pending>0} onclick={()=>move(index,1)}>↓</button>
 {#if term.children.length}<TaxonomyTermTree {taxonomy} terms={term.children} {parents} {locale} {labelSingular} {disabled} parentId={term.translationGroup??term.id}/>{/if}
</li>{/each}</ul>
<form {...form} hidden><input type="hidden" name="taxonomy" value={taxonomy}/><input type="hidden" name="parentId" value={parentId}/><input type="hidden" name="ids" value={JSON.stringify(ids)}/></form>
{#if message}<p role="alert">{message}</p>{/if}
<style>ul{list-style:none;padding-inline-start:16px}</style>
