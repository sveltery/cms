<script lang="ts">
 import {base} from '$app/paths';
 import {invalidateAll} from '$app/navigation';
 import type {Collection,Field} from '$lib/server/database/contract.ts';
 import {SEARCH_TOKENIZERS,type SearchConfig} from '$lib/server/search/types.ts';
 let {collections,mutationsEnabled}:{collections:(Collection&{fields:Field[];searchConfig:SearchConfig|null;stats:{indexed:number}|null})[];mutationsEnabled:boolean}=$props();
 let busy=$state<string>(),notice=$state(''),failure=$state('');
 async function operation(slug:string,endpoint:'enable'|'rebuild',body:Record<string,unknown>){
  busy=slug;notice='';failure='';
  try{
   const response=await fetch(`${base}/api/search/${endpoint}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({collection:slug,...body})});
   const result=await response.json();if(!response.ok||!result.success)throw new Error(result.error?.message??'Search update failed');
   notice=endpoint==='rebuild'?`Rebuilt ${slug}: ${result.data.indexed} entries`:`Search ${result.data.enabled?'enabled':'disabled'} for ${slug}`;await invalidateAll();
  }catch(cause){failure=cause instanceof Error?cause.message:'Search update failed';}finally{busy=undefined;}
 }
 function save(event:SubmitEvent,slug:string){
  event.preventDefault();const form=new FormData(event.currentTarget as HTMLFormElement);const weights:Record<string,number>={};
  for(const [key,value] of form)if(key.startsWith('weight:')){const number=Number(value);if(!Number.isFinite(number)){failure='Field weights must be finite numbers';return;}weights[key.slice(7)]=number;}
  void operation(slug,'enable',{enabled:form.has('enabled'),tokenize:form.get('tokenize'),weights});
 }
</script>
{#if !mutationsEnabled}<p role="status">Search management is disabled for this deployment.</p>{/if}
{#if notice}<p role="status">{notice}</p>{/if}{#if failure}<p role="alert">{failure}</p>{/if}
{#each collections as collection (collection.id)}
 <section><header><h2>{collection.label}</h2><p>{collection.searchConfig?.enabled?'Enabled':'Disabled'} · {collection.stats?.indexed??0} indexed entries</p></header>
  <form onsubmit={event=>save(event,collection.slug)}>
   <fieldset disabled={!mutationsEnabled||busy===collection.slug}>
    <label><input type="checkbox" name="enabled" checked={collection.searchConfig?.enabled??false}/> Enable search</label>
    <label>Tokenizer <select name="tokenize" value={collection.searchConfig?.tokenize??'porter unicode61'}>{#each SEARCH_TOKENIZERS as tokenizer}<option value={tokenizer}>{tokenizer}</option>{/each}</select></label>
    <div class="fields"><h3>Searchable fields and ranking weights</h3>
     {#each collection.fields.filter(field=>field.searchable) as field}<label>{field.label}<input type="number" name={`weight:${field.slug}`} step="any" value={collection.searchConfig?.weights?.[field.slug]??1}/></label>{:else}<p>Mark a field searchable in the collection schema before enabling search.</p>{/each}
    </div>
    <div class="actions"><button type="submit">Save search configuration</button><button type="button" disabled={!collection.searchConfig?.enabled} onclick={()=>operation(collection.slug,'rebuild',{})}>Rebuild index</button></div>
   </fieldset>
  </form>
 </section>
{:else}<p>No collections have been created.</p>{/each}
<style>section{border:1px solid #dfe3e9;background:#fff;border-radius:10px;padding:24px;margin:20px 0;}h2{margin:0;}header p{color:#526079;font-size:14px;}fieldset{border:0;padding:0;display:grid;gap:18px;}label{display:flex;align-items:center;gap:12px;}select,input[type=number]{padding:8px;border:1px solid #bdc7d5;border-radius:5px;}input[type=number]{max-width:120px;margin-left:auto;}.fields{display:grid;gap:12px;max-width:460px;}h3{font-size:15px;}.actions{display:flex;gap:12px;flex-wrap:wrap;}button{padding:10px 14px;border:1px solid #526079;border-radius:5px;background:#edf1ff;font:inherit;cursor:pointer;}[role=alert]{color:#a32020;}</style>
