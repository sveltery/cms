<script lang="ts">
 import {getEntryTaxonomies} from '$lib/taxonomies.remote';
 import TaxonomyPicker from './TaxonomyPicker.svelte';
 let {collection,id,locale,disabled}:{collection:string;id:string;locale:string;disabled:boolean}=$props();
 const taxonomies=$derived(await getEntryTaxonomies({collection,id,locale}));
</script>
<section aria-label="Taxonomies" class="taxonomies">
 <h3>Taxonomies</h3>
 {#each taxonomies as {definition,terms,assignment} (definition.name)}
  <TaxonomyPicker {collection} {id} {locale} {definition} {terms} {assignment} {disabled}/>
 {/each}
 {#if !taxonomies.length}<p>No taxonomies are bound to this collection.</p>{/if}
</section>
<style>.taxonomies{margin-block:24px;padding:24px;border:1px solid #d9e0eb;border-radius:12px}h3{margin-top:0}</style>
