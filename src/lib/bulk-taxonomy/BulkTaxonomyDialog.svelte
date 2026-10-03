<script lang="ts">
 import type {BulkTaxonomyDialogProps,BulkTaxonomyTerm} from './types';
 let {taxonomies,client,open,onClose,onClosed,selected,activeLocale,defaultLocale,adminLocale='en'}:BulkTaxonomyDialogProps=$props();
 let taxonomyName=$state<string|null>(null),termId=$state(''),urls=$state(''),terms=$state<BulkTaxonomyTerm[]>([]),loading=$state(false),termsFailed=$state(false),optionsOpen=$state(false);
 const taxonomy=$derived(taxonomies.find(def=>def.name===taxonomyName)??taxonomies[0]);
 const name=$derived(taxonomy?.name??''),singular=$derived(taxonomy?.labelSingular||taxonomy?.label||'Term'),plural=$derived(taxonomy?.label||'Terms');
 const singularLower=$derived(adminLocale.split('-')[0]==='de'?singular:singular.toLowerCase()),pluralLower=$derived(adminLocale.split('-')[0]==='de'?plural:plural.toLowerCase());
 const termLocale=$derived(activeLocale??defaultLocale??'en');
 let wasOpen=false;
 $effect(()=>{if(open){wasOpen=true;return;}if(wasOpen){wasOpen=false;taxonomyName=null;termId='';urls='';optionsOpen=false;onClosed?.();}});
 $effect(()=>{if(!open||!taxonomy)return;const currentName=name,currentLocale=termLocale;let cancelled=false;loading=true;termsFailed=false;void client.terms(currentName,{locale:currentLocale,includeCounts:false,resolveFallback:true}).then(values=>{if(!cancelled)terms=values;}).catch(()=>{if(!cancelled){terms=[];termsFailed=true;}}).finally(()=>{if(!cancelled)loading=false;});return()=>{cancelled=true;};});
 export function setOpen(value:boolean){open=value;}
 const uniqueTerms=(values:BulkTaxonomyTerm[]):BulkTaxonomyTerm[]=>{const groups=new Map<string,BulkTaxonomyTerm>();for(const term of values){groups.set(term.translationGroup??term.id,term);for(const child of uniqueTerms(term.children))groups.set(child.translationGroup??child.id,child);}return[...groups.values()];};
 const options=$derived(uniqueTerms(terms));
</script>
{#if open}
 <div class="bulk-overlay">
  <div role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="bulk-taxonomy-heading" class="bulk-dialog">
   <header><h2 id="bulk-taxonomy-heading">Add {singularLower} to posts</h2><button type="button" aria-label="Close" onclick={onClose}>×</button><p>Existing {pluralLower} stay in place.</p></header>
   <div class="bulk-body">
    {#if taxonomies.length>1}<label>Taxonomy<select aria-label="Taxonomy" bind:value={taxonomyName}>{#each taxonomies as def}<option value={def.name}>{def.label}</option>{/each}</select></label>{/if}
    <div><label for="bulk-term">{singular}</label><button id="bulk-term" type="button" role="combobox" aria-label={singular} aria-expanded={optionsOpen} aria-controls="bulk-term-options" disabled={loading||termsFailed} onclick={()=>optionsOpen=!optionsOpen}>{options.find(term=>term.id===termId)?.label??`Choose ${singularLower}`}</button>
     {#if optionsOpen}<div id="bulk-term-options" role="listbox" aria-label={singular}>{#each options as term(term.id)}<button type="button" role="option" aria-selected={termId===term.id} data-term-id={term.id} onclick={()=>{termId=term.id;optionsOpen=false;}}>{term.label}</button>{/each}</div>{/if}
    </div>
    {#if termsFailed}<p role="alert">Could not load {pluralLower}.</p>{/if}
    {#if selected}<h3>Selected posts</h3><ul>{#each selected as post(post.id)}<li>{post.title} <span>{post.locale??''}</span></li>{/each}</ul>{:else}<label>Post URLs (one per line)<textarea aria-label="Post URLs (one per line)" rows="4" bind:value={urls}></textarea></label>{/if}
   </div>
   <footer><button type="button" onclick={onClose}>Cancel</button></footer>
  </div>
 </div>
{/if}
<style>
 .bulk-overlay{position:fixed;inset:0;background:rgb(0 0 0 / .4);display:grid;place-items:center;z-index:50}.bulk-dialog{width:min(720px,calc(100vw - 32px));height:min(480px,calc(100vh - 32px));display:flex;flex-direction:column;background:white;border:1px solid #bbb;border-radius:12px;color:#222;box-sizing:border-box}.bulk-dialog header,.bulk-dialog footer{padding:16px 24px;flex-shrink:0}.bulk-dialog header{position:relative;border-bottom:1px solid #ddd}.bulk-dialog header>button{position:absolute;inset-inline-end:16px;top:16px}.bulk-body{padding:20px 24px;overflow:auto;flex:1;min-height:0}.bulk-body label{display:block;margin-block-end:12px}.bulk-body textarea{display:block;width:100%;box-sizing:border-box}.bulk-dialog footer{display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #ddd}h2{margin:0}button,select,textarea{font:inherit}button[role=option]{display:block;width:100%;text-align:start}
</style>
