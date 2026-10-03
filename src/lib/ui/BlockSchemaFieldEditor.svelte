<script lang="ts">
 // Native Svelte transport of FieldEditor blocks configuration at immutable
 // EmDash913cb1bb (selection, ordered inventory, retirement and sparse limits).
 // Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt. This does not port
 // the complete general React FieldEditor or its unrelated field families.
 import {base} from '$app/paths';
 import type {BlockType} from '$lib/server/schema/block-types';
 import type {Field} from '$lib/server/database/contract';
 import {untrack,type Snippet} from 'svelte';
 let {open=true,chooseType=false,blockTypes,field,formAttributes={},context,labelCaption='Label',onSave,disabled=false}:{open?:boolean;chooseType?:boolean;blockTypes?:readonly BlockType[];field?:Field;formAttributes?:Record<string|symbol,unknown>;context?:Snippet;labelCaption?:string;onSave?:(input:unknown)=>void;disabled?:boolean}=$props();
 let configured=$state(untrack(()=>!chooseType)),types=$state<readonly BlockType[]>([]),message=$state(''),loading=$state(false);
 let slug=$state(untrack(()=>field?.slug??'')),label=$state(untrack(()=>field?.label??''));
 let allowedTypes=$state<string[]>(untrack(()=>[...(field?.validation?.allowedTypes??[])]));
 const retiredTypes=untrack(()=>[...(field?.validation?.retiredTypes??[])]);
 let minItems=$state(untrack(()=>field?.validation?.minItems?.toString()??'')),maxItems=$state(untrack(()=>field?.validation?.maxItems?.toString()??''));
 $effect(()=>{if(blockTypes){types=blockTypes;return;}if(!open||!configured)return;let live=true;loading=true;void fetch(`${base}/_emdash/api/schema/block-types`).then(response=>response.json()).then(result=>{if(live){if(!result.success)throw new Error(result.error?.message??'Block types could not be loaded');types=result.data.items;}}).catch(()=>{if(live)message='Block types could not be loaded.';}).finally(()=>{if(live)loading=false;});return()=>{live=false;};});
 function changeLabel(value:string){label=value;if(!field)slug=value.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');}
 function move(index:number,offset:number){const next=[...allowedTypes];[next[index],next[index+offset]]=[next[index+offset]!,next[index]!];allowedTypes=next;}
 function submit(event:SubmitEvent){if(!onSave)return;event.preventDefault();onSave({slug,label,type:'blocks',required:false,unique:false,indexed:false,validation:{allowedTypes:[...allowedTypes],...(minItems?{minItems:parseInt(minItems,10)}:{}),...(maxItems?{maxItems:parseInt(maxItems,10)}:{})}});}
</script>
{#if open}
 {#if !configured}<button type="button" onclick={()=>configured=true}>Blocks · Ordered page-building blocks</button>
 {:else}<form {...formAttributes} onsubmit={submit}>
  <fieldset {disabled}><legend>{field?'Edit a blocks field':'Add a blocks field'}</legend>
   {@render context?.()}
   {#if field}<input type="hidden" name="field" value={field.slug}/>{/if}
   <label>Block field slug<input name={field?undefined:'slug'} pattern="[a-z][a-z0-9_]*" required bind:value={slug} readonly={Boolean(field)}/></label>
   <label>{labelCaption}<input name="label" required maxlength="200" value={label} oninput={event=>changeLabel(event.currentTarget.value)}/></label>
   <fieldset><legend>Allowed block types</legend><p>The order controls how block types appear in the picker.</p>
    {#each allowedTypes as chosen}<input type="hidden" name="allowedTypes[]" value={chosen}/>{/each}
    {#if loading}<p>Loading block types…</p>{:else if message}<p role="alert">{message}</p>{:else if types.length===0}<p>Create a block type before adding a blocks field.</p>{:else}
     {#each types as type(type.slug)}
      {@const selectedIndex=allowedTypes.indexOf(type.slug)}{@const selected=selectedIndex!==-1}{@const retired=retiredTypes.includes(type.slug)}
      <article><div class="selection"><label><input type="checkbox" checked={selected} disabled={retired&&!selected} onchange={event=>{allowedTypes=event.currentTarget.checked?[...allowedTypes,type.slug]:allowedTypes.filter(slug=>slug!==type.slug);}}/>{type.label}</label><code>{type.slug}</code>{#if retired}<span>Retired</span>{/if}
       {#if selected}<button type="button" disabled={selectedIndex===0} aria-label={`Move ${type.label} up`} onclick={()=>move(selectedIndex,-1)}>↑</button><button type="button" disabled={selectedIndex===allowedTypes.length-1} aria-label={`Move ${type.label} down`} onclick={()=>move(selectedIndex,1)}>↓</button>{/if}
      </div><div class="versions">{#each type.versions as version(version.version)}<span>{version.active?`Active v${version.version}`:`v${version.version}`}</span> · <code title={version.fingerprint}>{version.fingerprint.slice(-8)}</code>{/each}</div></article>
     {/each}
    {/if}
   </fieldset>
   <label>Minimum blocks<input type="number" min="0" name="minItems" value={minItems} oninput={event=>minItems=event.currentTarget.value} placeholder="0"/></label>
   <label>Maximum blocks<input type="number" min="1" max="100" name="maxItems" value={maxItems} oninput={event=>maxItems=event.currentTarget.value} placeholder="100"/></label>
   <button type="submit">{field?'Save Field':'Add Field'}</button>
  </fieldset>
 </form>{/if}
{/if}
<style>form,fieldset{display:grid;gap:14px}fieldset,article{padding:20px;border:1px solid #d9e0eb;border-radius:8px}label{display:grid;gap:6px}input:not([type=checkbox]){padding:9px;font:inherit;border:1px solid #c4cedd;border-radius:6px}button{padding:9px 14px;justify-self:start}.selection,.versions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}code{overflow-wrap:anywhere}</style>
