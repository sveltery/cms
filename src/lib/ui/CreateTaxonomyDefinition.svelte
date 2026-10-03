<script lang="ts">
 import {createTaxonomyDefinition} from '$lib/taxonomies.remote';
 let {collections,definitions,disabled}:{collections:{slug:string;label:string}[];definitions:{id:string;name:string;label:string;locale:string}[];disabled:boolean}=$props();
 let selected=$state<string[]>([]),name=$state(''),source=$state('');
</script>
<form {...createTaxonomyDefinition}>
 <fieldset {disabled}><legend>Create taxonomy</legend>
  <label>Name <input name="name" bind:value={name} readonly={Boolean(source)} required maxlength="63" pattern="[a-z][a-z0-9_]*"/></label>
  <label>Label <input {...createTaxonomyDefinition.fields.label.as('text')} required maxlength="200"/></label>
  <label>Singular label <input {...createTaxonomyDefinition.fields.labelSingular.as('text')} maxlength="200"/></label>
  <label><input {...createTaxonomyDefinition.fields.hierarchical.as('checkbox')}/> Hierarchical</label>
  <label>Locale <input {...createTaxonomyDefinition.fields.locale.as('text')} value="en" required/></label>
  <label>Translation of <select name="translationOf" bind:value={source} onchange={()=>{const definition=definitions.find(def=>def.id===source);if(definition)name=definition.name;}}><option value="">Standalone taxonomy</option>{#each definitions as definition}<option value={definition.id}>{definition.label} ({definition.locale})</option>{/each}</select></label>
  <fieldset><legend>Collections</legend>{#each collections as collection}<label><input type="checkbox" bind:group={selected} value={collection.slug}/>{collection.label}</label>{/each}</fieldset>
  <input type="hidden" name="collections" value={JSON.stringify(selected)}/><button disabled={createTaxonomyDefinition.pending>0}>Create taxonomy</button>
 </fieldset>
 {#each createTaxonomyDefinition.fields.allIssues()??[] as issue}<p role="alert">{issue.message}</p>{/each}
 {#if createTaxonomyDefinition.result}<p role="status">Taxonomy created.</p>{/if}
</form>
<style>fieldset{margin-block:16px;padding:16px;border:1px solid #d9e0eb;border-radius:8px}label{display:block;margin-block:10px}input:not([type='checkbox'],[type='hidden']){display:block;width:100%;padding:8px}button{padding:10px 16px}</style>
