<script lang="ts">
 import {untrack} from 'svelte';
 import {updateTaxonomyDefinition,deleteTaxonomyDefinition} from '$lib/taxonomies.remote';
 import type {TaxonomyDef} from '$lib/server/taxonomies/upstream/taxonomies/types';
 let {definition,collections,disabled}:{definition:TaxonomyDef;collections:{slug:string;label:string}[];disabled:boolean}=$props();
 const form=$derived(updateTaxonomyDefinition.for(definition.id));
 let selected=$state<string[]>(untrack(()=>[...definition.collections])),confirm=$state(false);
</script>
<details><summary>Taxonomy settings</summary>
 <form {...form}><fieldset {disabled}><legend>Edit {definition.label}</legend>
  <input type="hidden" name="name" value={definition.name}/><input type="hidden" name="locale" value={definition.locale}/>
  <label>Label <input name="label" value={definition.label} required/></label><label>Singular label <input name="labelSingular" value={definition.labelSingular??''}/></label>
  <label><input {...form.fields.hierarchical.as('checkbox')} checked={definition.hierarchical}/>Hierarchical</label>
  <fieldset><legend>Collections</legend>{#each collections as collection}<label><input type="checkbox" bind:group={selected} value={collection.slug}/>{collection.label}</label>{/each}</fieldset>
  <input type="hidden" name="collections" value={JSON.stringify(selected)}/><button>Save taxonomy</button>
 </fieldset></form>
 {#each form.fields.allIssues()??[] as issue}<p role="alert">{issue.message}</p>{/each}
 <button type="button" {disabled} onclick={()=>confirm=true}>Delete taxonomy</button>
 {#if confirm}<div role="dialog" aria-label="Delete taxonomy"><p>Delete {definition.label}? All terms and assignments will be removed permanently.</p><form {...deleteTaxonomyDefinition}><input type="hidden" name="taxonomy" value={definition.name}/><button>Delete taxonomy</button></form><button type="button" onclick={()=>confirm=false}>Cancel</button></div>{/if}
</details>
<style>details{margin-block:20px}fieldset{padding:16px;border:1px solid #d9e0eb}label{display:block;margin-block:10px}input:not([type='checkbox'],[type='hidden']){display:block;width:100%;padding:8px}button{margin:8px;padding:8px}</style>
