<script lang="ts">
 import {createTaxonomyTerm} from '$lib/taxonomies.remote';
 import type {TermWithCount} from '$lib/server/taxonomies/upstream/api/handlers/taxonomies';
 let {taxonomy,locale,terms,disabled}:{taxonomy:string;locale:string;terms:TermWithCount[];disabled:boolean}=$props();
 const form=$derived(createTaxonomyTerm.for(JSON.stringify([taxonomy,locale])));
</script>
<form {...form}><fieldset {disabled}><legend>Create term</legend>
 <input type="hidden" name="taxonomy" value={taxonomy}/><input type="hidden" name="locale" value={locale}/>
 <label>Label <input {...form.fields.label.as('text')} required/></label><label>Slug <input {...form.fields.slug.as('text')} placeholder="Generated from label"/></label>
 <label>Description <textarea {...form.fields.description.as('text')}></textarea></label>
 <label>Parent <select name="parentId"><option value="">None</option>{#each terms as term}<option value={term.translationGroup??term.id}>{term.label}</option>{/each}</select></label>
 <label>Translation of <select name="translationOf"><option value="">Standalone term</option>{#each terms as term}<option value={term.id}>{term.label} ({term.locale})</option>{/each}</select></label>
 <button disabled={form.pending>0}>Create term</button></fieldset>
 {#each form.fields.allIssues()??[] as issue}<p role="alert">{issue.message}</p>{/each}
 {#if form.result}<p role="status">Term created.</p>{/if}
</form>
<style>fieldset{padding:16px;border:1px solid #d9e0eb;border-radius:8px}label{display:block;margin-block:12px}input,textarea,select{display:block;padding:8px;width:100%}button{padding:10px 16px}</style>
