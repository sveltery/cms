<script lang="ts">
 import type {TermWithCount as TaxonomyTerm} from '$lib/server/taxonomies/upstream/api/handlers/taxonomies';
 import TaxonomyCheckboxes from './TaxonomyCheckboxes.svelte';
 let {terms,selected,onchange,disabled=false}:{terms:TaxonomyTerm[];selected:string[];onchange:(id:string,checked:boolean)=>void;disabled?:boolean}=$props();
</script>
<ul>
 {#each terms as term (term.id)}
  <li><label><input type="checkbox" checked={selected.includes(term.id)} {disabled} onchange={event=>onchange(term.id,event.currentTarget.checked)}/>{term.label}</label>
   {#if term.children?.length}<TaxonomyCheckboxes terms={term.children} {selected} {onchange} {disabled}/>{/if}
  </li>
 {/each}
</ul>
<style>ul{list-style:none;padding-inline-start:16px}li{margin-block:8px}label{display:flex;gap:8px;align-items:center}</style>
