<script lang="ts">
 // Native form transport around the existing blocks-field controls. The complete
 // upstream FieldEditor callback is hosted separately before extending editing.
 import {base} from '$app/paths';
 import BlockTypeList from './BlockTypeList.svelte';
 import type {BlockType} from '$lib/server/schema/block-types';
 import {untrack,type Snippet} from 'svelte';
 let {open=true,chooseType=false,blockTypes,formAttributes={},context,labelCaption='Label',onSave}:{open?:boolean;chooseType?:boolean;blockTypes?:readonly BlockType[];formAttributes?:Record<string|symbol,unknown>;context?:Snippet;labelCaption?:string;onSave?:(input:unknown)=>void}=$props();
 let configured=$state(untrack(()=>!chooseType)),types=$state<readonly BlockType[]>([]),message=$state(''),slug=$state(''),label=$state('');
 $effect(()=>{if(blockTypes){types=blockTypes;return;}if(!open||!configured)return;let live=true;void fetch(`${base}/_emdash/api/schema/block-types`).then(response=>response.json()).then(result=>{if(live){if(!result.success)throw new Error(result.error?.message??'Block types could not be loaded');types=result.data.items;}}).catch(()=>{if(live)message='Block types could not be loaded.';});return()=>{live=false;};});
 function submit(event:SubmitEvent){if(!onSave)return;event.preventDefault();const data=new FormData(event.currentTarget as HTMLFormElement);onSave({slug,label,type:'blocks',required:false,unique:false,indexed:false,validation:{allowedTypes:data.getAll('allowedTypes[]'),minItems:Number(data.get('minItems')),maxItems:Number(data.get('maxItems'))}});}
</script>
{#if open}
 {#if !configured}<button type="button" onclick={()=>configured=true}>Blocks · Ordered page-building blocks</button>
 {:else}<form {...formAttributes} onsubmit={submit}>
  <fieldset><legend>Add a blocks field</legend>
   {@render context?.()}
   <label>Block field slug<input name="slug" pattern="[a-z][a-z0-9_]*" required bind:value={slug}/></label>
   <label>{labelCaption}<input name="label" required bind:value={label} oninput={()=>{if(!slug)slug=label.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');}}/></label>
   <BlockTypeList blockTypes={types}/>
   <fieldset><legend>Allowed block types</legend>{#each types as type}<label><input type="checkbox" name="allowedTypes[]" value={type.slug}/>{type.label}</label>{/each}</fieldset>
   <label>Minimum blocks<input type="number" min="0" max="100" name="minItems" value="0" required/></label>
   <label>Maximum blocks<input type="number" min="1" max="100" name="maxItems" value="100" required/></label>
   <button type="submit">Add Field</button>
  </fieldset>
  {#if message}<p role="alert">{message}</p>{/if}
 </form>{/if}
{/if}
<style>form,fieldset{display:grid;gap:14px}fieldset{padding:20px;border:1px solid #d9e0eb;border-radius:8px}label{display:grid;gap:6px}input:not([type=checkbox]){padding:9px;font:inherit;border:1px solid #c4cedd;border-radius:6px}button{padding:9px 14px;justify-self:start}</style>
