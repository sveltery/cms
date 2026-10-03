<script lang="ts">
import Dialog from './BulkTaxonomyDialog.svelte';
import type { BulkTaxonomyClient, BulkTaxonomyDefinition, BulkSelectedPost } from './types';
let { collection, collectionLabel, items, taxonomies, client, activeLocale, defaultLocale, adminLocale = 'en' }: {
    collection: string;
    collectionLabel: string;
    items: BulkSelectedPost[];
    taxonomies: BulkTaxonomyDefinition[];
    client: BulkTaxonomyClient;
    activeLocale?: string;
    defaultLocale?: string;
    adminLocale?: string;
} = $props();
let selectedIds = $state(new Set<string>()), open = $state(false), selected = $state<BulkSelectedPost[] | undefined>();
const singular = $derived(taxonomies[0]?.labelSingular || taxonomies[0]?.label || 'Term');
const singularLower = $derived(adminLocale.split('-')[0] === 'de' ? singular : singular.toLowerCase());
</script>
<section aria-label={collectionLabel}><h1>{collectionLabel}</h1><ul>{#each items as item(item.id)}<li><label><input type="checkbox" aria-label={`Select ${item.title}`} checked={selectedIds.has(item.id)} onchange={()=>{const next=new Set(selectedIds);next.has(item.id)?next.delete(item.id):next.add(item.id);selectedIds=next;}} />{item.title}</label></li>{/each}</ul>
{#if selectedIds.size&&taxonomies.length}<button type="button" disabled={selectedIds.size>50} onclick={()=>{selected=[...selectedIds].map(id=>items.find(item=>item.id===id)??{collection,id,title:id});open=true;}}>Add {taxonomies.length===1?singularLower:'term'}</button>{#if selectedIds.size>50}<span role="status">Select up to 50 posts at a time.</span>{/if}{/if}
<Dialog {taxonomies} {client} {open} {selected} {activeLocale} {defaultLocale} {adminLocale} onClose={()=>open=false} onClosed={()=>selected=undefined} onApplied={results=>{selectedIds=new Set(results.flatMap(result=>(result.status==='failed'||result.status==='unmatched')&&'id'in result.input?[result.input.id]:[]));}} />
</section>
