<script lang="ts">
 import {resolve} from '$app/paths';
 import {isHttpError} from '@sveltejs/kit';
 import {updateTaxonomyTerm,listTaxonomyTerms} from '$lib/taxonomies.remote';
 import type {TermWithCount} from '$lib/server/taxonomies/upstream/api/handlers/taxonomies';
 let {taxonomy,term,locale,labelSingular,parents,disabled}:{taxonomy:string;term:TermWithCount;locale:string;labelSingular:string;parents:TermWithCount[];disabled:boolean}=$props();
 const form=$derived(updateTaxonomyTerm.for(term.id));let confirm=$state(false),editing=$state(false),deleting=$state(false),message=$state<string|undefined>();
 async function remove(){deleting=true;message=undefined;try{const response=await fetch(resolve('/api/taxonomies/[taxonomy]/terms/[slug]',{taxonomy,slug:term.slug})+`?locale=${encodeURIComponent(locale)}`,{method:'DELETE',headers:{origin:location.origin}});const payload=await response.json();if(!response.ok)throw new Error(payload.message??payload.error?.message??'Term could not be deleted.');await listTaxonomyTerms({taxonomy,locale}).refresh();confirm=false;}catch(cause){message=isHttpError(cause)?cause.body.message:(cause as Error).message;}finally{deleting=false;}}
</script>
<article>
 <div class="heading"><strong>{term.label}</strong><span>{term.slug}</span><span>{term.count??0} entries</span></div>
 {#if term.description}<p>{term.description}</p>{/if}
 <button type="button" {disabled} onclick={()=>editing=!editing}>Edit {term.label}</button>
 <button type="button" {disabled} onclick={()=>confirm=true}>Delete {term.label}</button>
 {#if editing}<form {...form}><fieldset {disabled}><legend>Edit term</legend>
  <input type="hidden" name="taxonomy" value={taxonomy}/><input type="hidden" name="originalSlug" value={term.slug}/><input type="hidden" name="locale" value={locale}/>
  <label>Label <input name="label" value={term.label} required/></label><label>Slug <input name="slug" value={term.slug}/></label>
  <label>Description <textarea name="description">{term.description??''}</textarea></label>
  <label>Parent <select name="parentId" value={term.parentId??''}><option value="">None</option>{#each parents.filter(parent=>parent.translationGroup!==term.translationGroup) as parent}<option value={parent.translationGroup??parent.id}>{parent.label}</option>{/each}</select></label>
  <button>Save term</button></fieldset></form>{#each form.fields.allIssues()??[] as issue}<p role="alert">{issue.message}</p>{/each}{/if}
 {#if confirm}<div role="dialog" aria-label={`Delete ${labelSingular}?`}><h2>Delete {labelSingular}?</h2><p><span>{term.label}</span> will be deleted permanently. Its assignments will be removed.</p><button type="button" onclick={remove} disabled={deleting}>Delete</button><button type="button" onclick={()=>confirm=false} disabled={deleting}>Cancel</button>{#if message}<p role="alert">{message}</p>{/if}</div>{/if}
</article>
<style>article{padding:16px;margin-block:12px;border:1px solid #d9e0eb;border-radius:8px}.heading{display:flex;gap:16px;align-items:center}.heading span{color:#526079}button{padding:8px 12px;margin:8px 8px 0 0}label{display:block;margin-block:12px}input,textarea,select{display:block;padding:8px;width:100%}[role='dialog']{padding:20px;background:#fff;border:1px solid #c4cedd;border-radius:8px;margin-block:12px}</style>
