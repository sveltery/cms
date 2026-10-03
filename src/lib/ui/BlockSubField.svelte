<script lang="ts">
 import type {BlockFieldDefinition} from '$lib/server/schema/block-types';
 import BlockMediaField from './BlockMediaField.svelte';
 import {mediaDisplayUrl,type ImageFieldValue} from '$lib/blocks/media-values';
 import Self from './BlockSubField.svelte';
 import {toDatetimeLocalInputValue,fromDatetimeLocalInputValue} from '$lib/blocks/datetime-local';
 let {id,field,value,onchange,readOnly=false,timezone='UTC'}:{id:string;field:BlockFieldDefinition;value:unknown;onchange:(value:unknown)=>void;readOnly?:boolean;timezone?:string}=$props();
 const primaryImage=$derived((typeof value==='object'&&value?value:typeof value==='string'&&value?{id:'',src:value}:undefined) as ImageFieldValue|undefined);
 const string=$derived(typeof value==='string'?value:'');
 const rows=$derived(Array.isArray(value)?value.filter((row):row is Record<string,unknown>=>Boolean(row&&typeof row==='object'&&!Array.isArray(row))):[]);
 function inputValue(next:string){
  if(field.type==='datetime'){try{onchange(fromDatetimeLocalInputValue(next,timezone));}catch{onchange(next);}}
  else onchange(field.type==='number'||field.type==='integer'?(next===''?undefined:Number(next)):next);
 }
 function editRow(index:number,slug:string,next:unknown){onchange(rows.map((row,i)=>i===index?{...row,[slug]:next}:row));}
</script>
{#if field.type==='image'||field.type==='file'}
 <BlockMediaField {id} label={field.label} {value} {onchange} {readOnly} image={field.type==='image'} allowedMimeTypes={field.validation?.allowedMimeTypes}/>
 {#if field.type==='image'&&field.options?.darkVariant&&primaryImage&&mediaDisplayUrl(primaryImage)}
  <BlockMediaField id={`${id}.darkVariant`} label={`${field.label} (dark variant)`} value={value&&typeof value==='object'&&'darkVariant'in value?value.darkVariant:undefined} onchange={darkVariant=>{const next:Record<string,unknown>={...primaryImage};if(darkVariant===null)delete next.darkVariant;else next.darkVariant=darkVariant;onchange(next);}} {readOnly} image allowedMimeTypes={field.validation?.allowedMimeTypes}/>
 {/if}
{:else if field.type==='repeater'}
 <fieldset disabled={readOnly}><legend>{field.label}</legend>
  {#each rows as row,index(index)}<div class="row">
   {#each field.validation?.subFields??[] as subField(subField.slug)}<Self id={`${id}.${index}.${subField.slug}`} field={{slug:subField.slug,label:subField.label,type:subField.type,required:subField.required,validation:subField.options?{options:subField.options}:undefined}} value={row[subField.slug]} onchange={next=>editRow(index,subField.slug,next)} {readOnly} {timezone}/>{/each}
   {#if !readOnly}<button type="button" onclick={()=>onchange(rows.filter((_,i)=>i!==index))}>Remove row {index+1}</button>{/if}
  </div>{/each}
  {#if !readOnly}<button type="button" disabled={rows.length>=(field.validation?.maxItems??Infinity)} onclick={()=>onchange([...rows,{}])}>Add row</button>{/if}
 </fieldset>
{:else if field.type==='portableText'}
 <p>{field.label}: the rich text editor is unavailable.</p>
 {#if value!==undefined}<details><summary>Stored rich text</summary><pre>{JSON.stringify(value,null,2)}</pre></details>{/if}
{:else if field.type==='boolean'}
 <label><input {id} type="checkbox" checked={value===true} disabled={readOnly} onchange={event=>onchange(event.currentTarget.checked)}/>{field.label}</label>
{:else if field.type==='select'||field.type==='multiSelect'}
 <label for={id}>{field.label}</label>
 <select {id} multiple={field.type==='multiSelect'} disabled={readOnly} value={field.type==='multiSelect'?(Array.isArray(value)?value:[]):string} onchange={event=>onchange(field.type==='multiSelect'?Array.from(event.currentTarget.selectedOptions,option=>option.value):event.currentTarget.value)}>
  {#if field.type==='select'}<option value="">Choose an option</option>{/if}{#each field.validation?.options??[] as option}<option value={option}>{option}</option>{/each}
 </select>
{:else if field.type==='text'}
 <label for={id}>{field.label}</label><textarea {id} value={string} readonly={readOnly} required={field.required} oninput={event=>onchange(event.currentTarget.value)}></textarea>
{:else}
 <label for={id}>{field.label}</label>
 <input {id} type={field.type==='url'?'url':field.type==='number'||field.type==='integer'?'number':field.type==='datetime'?'datetime-local':'text'} value={field.type==='datetime'?toDatetimeLocalInputValue(value,timezone):typeof value==='number'?value:string} readonly={readOnly} required={field.required} step={field.type==='integer'?1:field.type==='number'?'any':undefined}
  oninput={event=>inputValue(event.currentTarget.value)}/>
{/if}
<style>label{display:block;margin-block-end:6px}input:not([type=checkbox]),textarea,select{inline-size:100%;padding:9px;border:1px solid #c4cedd;border-radius:6px;font:inherit}textarea{min-block-size:90px}fieldset,.row{border:1px solid #d9e0eb;padding:12px;display:grid;gap:12px}.row{margin-block:12px}pre{overflow:auto}</style>
