<script lang="ts">
 import {base} from '$app/paths';
 import {invalidateAll} from '$app/navigation';
 import {untrack} from 'svelte';
 import type {BlockType,BlockFieldDefinition} from '$lib/server/schema/block-types';
 import {BLOCK_FIELD_TYPES} from '$lib/blocks/field-types';
 let {type,oncomplete}:{type?:BlockType;oncomplete?:()=>void}=$props();
 let slug=$state(untrack(()=>type?.slug??'')),label=$state(untrack(()=>type?.label??'')),description=$state(untrack(()=>type?.description??'')),category=$state(untrack(()=>type?.category??'')),icon=$state(untrack(()=>type?.icon??''));
 let fields=$state<BlockFieldDefinition[]>(untrack(()=>structuredClone(type?.versions.find(version=>version.version===type.currentVersion)?.fields??[]))),breaking=$state(false),message=$state(''),pending=$state(false);
 function change(index:number,patch:Partial<BlockFieldDefinition>){fields=fields.map((field,i)=>i===index?{...field,...patch}:field);}
 function validation(index:number,key:string,value:unknown){const next={...fields[index]!.validation};if(value===undefined)delete (next as Record<string,unknown>)[key];else (next as Record<string,unknown>)[key]=value;change(index,{validation:next});}
 async function save(){pending=true;message='';try{
  const payload={label,description,category,icon,fields,...(type?{expectedFingerprint:type.versions.find(version=>version.version===type.currentVersion)!.fingerprint,breaking}:{slug})};
  const response=await fetch(`${base}/_emdash/api/schema/block-types${type?`/${encodeURIComponent(type.slug)}`:''}`,{method:type?'PUT':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),result=await response.json();
  if(!response.ok||!result.success)throw new Error(result.error?.message??'Block definition could not save');
  await invalidateAll();oncomplete?.();message=type?'Block type updated':'Block type created';
 }catch(cause){message=cause instanceof Error?cause.message:'Block definition could not save';}finally{pending=false;}}
</script>
<form onsubmit={event=>{event.preventDefault();void save();}}><fieldset disabled={pending}>
 <legend>{type?'Edit block type':'Create block type'}</legend>
 <label>Block type slug<input required pattern="[a-z][a-z0-9_]*" maxlength="63" bind:value={slug} readonly={Boolean(type)}/></label>
 <label>Block type label<input required maxlength="200" bind:value={label}/></label>
 <label>Description<textarea bind:value={description}></textarea></label><label>Category<input bind:value={category}/></label><label>Icon<input bind:value={icon}/></label>
 <h3>Fields</h3>
 {#each fields as field,index(index)}<fieldset><legend>Field {index+1}</legend>
  <label>Field slug<input required pattern="[a-z][a-z0-9_]*" maxlength="63" value={field.slug} oninput={event=>change(index,{slug:event.currentTarget.value})}/></label>
  <label>Field label<input required value={field.label} oninput={event=>change(index,{label:event.currentTarget.value})}/></label>
  <label>Field type<select value={field.type} onchange={event=>change(index,{type:event.currentTarget.value as BlockFieldDefinition['type'],validation:undefined,options:undefined})}>{#each BLOCK_FIELD_TYPES as option}<option value={option}>{option}</option>{/each}</select></label>
  <label><input type="checkbox" checked={field.required??false} onchange={event=>change(index,{required:event.currentTarget.checked})}/>Required</label>
  {#if field.type==='select'||field.type==='multiSelect'}<label>Options, one per line<textarea value={(field.validation?.options??[]).join('\n')} oninput={event=>validation(index,'options',event.currentTarget.value.split('\n').filter(Boolean))}></textarea></label>{/if}
  {#if ['string','text','url'].includes(field.type)}<label>Minimum length<input type="number" min="0" value={field.validation?.minLength??''} oninput={event=>validation(index,'minLength',event.currentTarget.value?Number(event.currentTarget.value):undefined)}/></label><label>Maximum length<input type="number" min="0" value={field.validation?.maxLength??''} oninput={event=>validation(index,'maxLength',event.currentTarget.value?Number(event.currentTarget.value):undefined)}/></label><label>Pattern<input value={field.validation?.pattern??''} oninput={event=>validation(index,'pattern',event.currentTarget.value||undefined)}/></label>{/if}
  {#if field.type==='number'||field.type==='integer'}<label>Minimum<input type="number" step="any" value={field.validation?.min??''} oninput={event=>validation(index,'min',event.currentTarget.value?Number(event.currentTarget.value):undefined)}/></label><label>Maximum<input type="number" step="any" value={field.validation?.max??''} oninput={event=>validation(index,'max',event.currentTarget.value?Number(event.currentTarget.value):undefined)}/></label>{/if}
  {#if field.type==='file'}<label>Allowed MIME types, one per line<textarea value={(field.validation?.allowedMimeTypes??[]).join('\n')} oninput={event=>validation(index,'allowedMimeTypes',event.currentTarget.value.split('\n').filter(Boolean))}></textarea></label>{/if}
  {#if field.type==='image'}<label><input type="checkbox" checked={field.options?.darkVariant??false} onchange={event=>change(index,{options:{darkVariant:event.currentTarget.checked}})}/>Dark variant</label>{/if}
  {#if field.type==='repeater'}<label>Repeater subfields (JSON)<textarea value={JSON.stringify(field.validation?.subFields??[],null,2)} onchange={event=>{try{validation(index,'subFields',JSON.parse(event.currentTarget.value));message='';}catch{message='Enter valid repeater subfield JSON';}}}></textarea></label>{/if}
  <details><summary>Default value</summary><label>Default value (JSON)<textarea value={field.defaultValue===undefined?'':JSON.stringify(field.defaultValue)} onchange={event=>{try{change(index,{defaultValue:event.currentTarget.value?JSON.parse(event.currentTarget.value):undefined});message='';}catch{message='Enter valid default value JSON';}}}></textarea></label></details>
  <button type="button" disabled={index===0} onclick={()=>{const next=[...fields];[next[index-1],next[index]]=[next[index]!,next[index-1]!];fields=next;}}>Move field up</button><button type="button" onclick={()=>fields=fields.filter((_,i)=>i!==index)}>Remove field</button>
 </fieldset>{/each}
 <button type="button" onclick={()=>fields=[...fields,{slug:'',label:'',type:'string'}]}>Add field</button>
 {#if type}<label><input type="checkbox" bind:checked={breaking}/>Create a new inactive version for breaking changes</label>{/if}
 <button type="submit">{pending?'Saving…':type?'Save block type':'Create block type'}</button>
</fieldset>{#if message}<p role="status">{message}</p>{/if}</form>
<style>form,fieldset{display:grid;gap:16px}fieldset{border:1px solid #d9e0eb;padding:20px;border-radius:8px}label{display:grid;gap:6px}input:not([type=checkbox]),textarea,select{padding:9px;font:inherit;border:1px solid #c4cedd;border-radius:6px}textarea{min-block-size:80px}button{padding:9px 14px;justify-self:start}</style>
