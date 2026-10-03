<script lang="ts">
 import {tick,untrack} from 'svelte';
 import {isHttpError} from '@sveltejs/kit';
 import {setEntryTaxonomyTerms} from '$lib/taxonomies.remote';
 import type {TaxonomyDef} from '$lib/server/taxonomies/upstream/taxonomies/types';
 import type {TermWithCount as TaxonomyTerm} from '$lib/server/taxonomies/upstream/api/handlers/taxonomies';
 import TaxonomyCheckboxes from './TaxonomyCheckboxes.svelte';
 let {collection,id,locale,definition,terms,assignment,disabled}:{collection:string;id:string;locale:string;definition:TaxonomyDef;terms:TaxonomyTerm[];assignment:{terms:{id:string;label:string}[];unresolved:{translationGroup:string;availableLocales:string[]}[]};disabled:boolean}=$props();
 const form=$derived(setEntryTaxonomyTerms.for(JSON.stringify([collection,id,locale,definition.name])));
 let open=$state(false),selected=$state<string[]>(untrack(()=>assignment.terms.map(term=>term.id))),saving=$state(false),message=$state<string|undefined>(),dirty=$state(false),sent=$state<string[]>([]);
 $effect(()=>{const ids=assignment.terms.map(term=>term.id);if(!saving&&!dirty)selected=ids;});
 async function save(){
  saving=true;sent=[...selected];dirty=false;message=undefined;
  try{await tick();if(!await form.submit())message='Terms could not be saved.';}
  catch(cause){message=isHttpError(cause)?cause.body.message:'Terms could not be saved.';}
  finally{saving=false;}
 }
 function change(termId:string,checked:boolean){selected=checked?[...new Set([...selected,termId])]:selected.filter(id=>id!==termId);dirty=true;}
 $effect(()=>{if(!dirty||disabled||saving)return;const timer=setTimeout(()=>{void save();},150);return()=>clearTimeout(timer);});
</script>
<div class="picker">
 <p>{assignment.terms.map(term=>term.label).join(', ')||`No ${definition.label.toLowerCase()} selected`}</p>
 <button type="button" aria-expanded={open} onclick={()=>open=!open}>Choose {definition.label}</button>
 {#if open}
  <div role="dialog" aria-label={`Choose ${definition.label}`}>
   <TaxonomyCheckboxes {terms} {selected} onchange={change} {disabled}/>
   {#if !terms.length}<p>No terms are available in this locale.</p>{/if}
   <button type="button" onclick={()=>open=false}>Close</button>
  </div>
 {/if}
 {#each assignment.unresolved as unresolved}<p role="status">Assigned term has no label in this locale. Available in {unresolved.availableLocales.join(', ')||'no locale'}.</p>{/each}
 {#if saving}<p role="status">Saving terms…</p>{/if}
 {#if message}<p role="alert">{message}</p>{/if}
 <form {...form} hidden aria-label={`Save ${definition.label}`}>
  <input type="hidden" name="collection" value={collection}/><input type="hidden" name="id" value={id}/><input type="hidden" name="locale" value={locale}/><input type="hidden" name="taxonomy" value={definition.name}/><input type="hidden" name="termIds" value={JSON.stringify(sent)}/>
 </form>
</div>
<style>.picker{padding-block:12px;border-top:1px solid #dfe3e9}button{padding:8px 12px}p{color:#526079}[role='dialog']{padding:12px;background:#fff;border:1px solid #dfe3e9;border-radius:8px}</style>
