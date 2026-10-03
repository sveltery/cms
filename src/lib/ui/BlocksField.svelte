<script lang="ts">
  // Native transport of the complete pinned BlocksField state transitions;
  // source: EmDash 913cb1bb admin/components/BlocksField.tsx, MIT Cloudflare Inc.
  import type {Snippet} from 'svelte';
  import type {BlockType,BlockFieldDefinition} from '$lib/server/schema/block-types';
  import {createBlockKey,createBlockValue,duplicateBlockValue,isStoredBlockValue,moveBlockValue,updateBlockFieldValue,type StoredBlockValue} from '$lib/blocks/state';
  import BlockSubField from './BlockSubField.svelte';
  export interface NestedFieldInput {name:string;field:{id:string;kind:string;label:string;required?:boolean;validation?:Record<string,unknown>;options?:unknown};value:unknown;onChange:(value:unknown)=>void}
  let {id,fieldPath,label,value,onchange,blockTypes,allowedTypes,retiredTypes,minItems=0,maxItems=100,readOnly=false,timezone='UTC',renderField}:{
    id:string;fieldPath:string;label:string;value:unknown;onchange:(value:StoredBlockValue[])=>void;blockTypes:readonly BlockType[];allowedTypes:readonly string[];retiredTypes:readonly string[];minItems?:number;maxItems?:number;readOnly?:boolean;timezone?:string;renderField?:Snippet<[NestedFieldInput]>;
  }=$props();
  let pickerOpen=$state(false),query=$state(''),collapsed=$state(new Set<string>()),keyboardKey=$state<string|undefined>(),pointerKey=$state<string|undefined>();
  const blocks=$derived(Array.isArray(value)?value.filter(isStoredBlockValue):[]);
  const typeBySlug=$derived(new Map(blockTypes.map(type=>[type.slug,type])));
  const allowed=$derived(allowedTypes.map(slug=>typeBySlug.get(slug)).filter((type):type is BlockType=>type!==undefined).filter(type=>{const needle=query.trim().toLocaleLowerCase();return !needle||type.label.toLocaleLowerCase().includes(needle)||type.slug.toLocaleLowerCase().includes(needle)||Boolean(type.category?.toLocaleLowerCase().includes(needle));}));
  const grouped=$derived.by(()=>{const result=new Map<string,BlockType[]>();for(const type of allowed){const category=type.category||'Other';result.set(category,[...(result.get(category)??[]),type]);}return result;});
  function toggle(key:string){const next=new Set(collapsed);if(next.has(key))next.delete(key);else next.add(key);collapsed=next;}
  function duplicate(index:number,block:StoredBlockValue){const next=[...blocks];next.splice(index+1,0,duplicateBlockValue($state.snapshot(block),createBlockKey()));onchange(next);}
  function move(key:string,to:number){onchange(moveBlockValue(blocks,blocks.findIndex(block=>block._key===key),to));}
  function keyboard(event:KeyboardEvent,key:string){
    if(event.code==='Space'){event.preventDefault();keyboardKey=keyboardKey===key?undefined:key;}
    else if(keyboardKey===key&&(event.key==='ArrowDown'||event.key==='ArrowUp')){event.preventDefault();move(key,blocks.findIndex(block=>block._key===key)+(event.key==='ArrowDown'?1:-1));}
    else if(event.key==='Escape')keyboardKey=undefined;
  }
  function summary(block:StoredBlockValue,fields:readonly BlockFieldDefinition[]){for(const field of fields){const value=block[field.slug];if(typeof value==='string'&&value.trim())return value.trim();}return null;}
  function nested(block:StoredBlockValue,field:BlockFieldDefinition):NestedFieldInput{
    return {name:`${fieldPath}.${block._key}.${field.slug}`,field:{id:`${id}:${block._key}:${field.slug}`,kind:field.type==='text'?'richText':field.type==='integer'?'number':field.type,label:field.label,required:field.required,validation:field.validation as Record<string,unknown>,options:Array.isArray(field.validation?.options)?field.validation.options.map(option=>({value:option,label:option})):field.options},value:block[field.slug],onChange:next=>onchange(updateBlockFieldValue(blocks,block._key,field.slug,next))};
  }
</script>
<div {id} class="blocks-field">
  <header><strong>{label}</strong>{#if !readOnly}<button type="button" disabled={blocks.length>=maxItems||allowed.length===0} onclick={()=>pickerOpen=!pickerOpen}>Add block</button>{/if}</header>
  {#if pickerOpen&&!readOnly}<div class="picker">
    <input aria-label="Search block types" placeholder="Search blocks" bind:value={query}/>
    {#each Array.from(grouped) as [category,types]}<p>{category}</p>{#each types as type(type.slug)}
      <button type="button" aria-label={type.label+(type.description??'')} onclick={()=>{onchange([...blocks,createBlockValue($state.snapshot(type),createBlockKey())]);pickerOpen=false;query='';}}><strong>{type.label}</strong>{#if type.description}<span>{type.description}</span>{/if}</button>
    {/each}{/each}
    {#if allowed.length===0}<p>No matching block types</p>{/if}
  </div>{/if}
  {#if blocks.length===0}<p>No blocks yet</p>{/if}
  {#each blocks as block,index(block._key)}
    {@const type=typeBySlug.get(block._type)}
    {@const version=type?.versions.find(candidate=>candidate.version===block._version)}
    {@const unsupported=!type||!version||Boolean(version.unsupportedTypes?.length)}
    {@const retired=retiredTypes.includes(block._type)}
    {@const blockSummary=version?summary(block,version.fields):null}
    <section data-block-key={block._key} class:dragging={keyboardKey===block._key||pointerKey===block._key}>
      <header>
        {#if !readOnly}<button type="button" aria-label={`Reorder ${type?.label??block._type}`} aria-pressed={keyboardKey===block._key} onkeydown={event=>keyboard(event,block._key)}
          draggable="true" ondragstart={event=>{pointerKey=block._key;event.dataTransfer?.setData('text/plain',block._key);}} ondragend={()=>pointerKey=undefined} ondragover={event=>event.preventDefault()} ondrop={event=>{event.preventDefault();if(pointerKey)move(pointerKey,index);pointerKey=undefined;}}>⠿</button>{/if}
        <button type="button" aria-label={collapsed.has(block._key)?'Expand block':'Collapse block'} onclick={()=>toggle(block._key)}>
          <svg viewBox="0 0 20 20" width="16" height="16" class={collapsed.has(block._key)?'rtl:-scale-x-100':''} aria-hidden="true"><path d={collapsed.has(block._key)?'M7 4l6 6-6 6':'M4 7l6 6 6-6'} fill="none" stroke="currentColor"/></svg>
        </button>
        <strong>{type?.label??block._type}</strong><span>Version {block._version}</span>
        {#if type&&block._version!==type.currentVersion}<span>Inactive version</span>{/if}
        {#if retired}<span>Retired</span>{/if}{#if unsupported}<span>Unsupported</span>{/if}
        {#if !readOnly}<button type="button" aria-label="Duplicate block" disabled={retired||unsupported} onclick={()=>duplicate(index,block)}>Duplicate</button><button type="button" aria-label="Delete block" onclick={()=>onchange(blocks.filter(item=>item._key!==block._key))}>Delete</button>{/if}
      </header>
      {#if blockSummary}<p class="summary">{blockSummary}</p>{/if}
      {#if !collapsed.has(block._key)}<div class="fields">
        {#if unsupported}<p>This block cannot be edited because its stored definition is unavailable.</p>
        {:else}{#each version?.fields??[] as field(field.slug)}
          {#if renderField}{@render renderField(nested(block,field))}
          {:else}<BlockSubField id={`field-${fieldPath}.${block._key}.${field.slug}`} {field} value={block[field.slug]} {readOnly} {timezone} onchange={next=>onchange(updateBlockFieldValue(blocks,block._key,field.slug,next))}/>{/if}
        {/each}{/if}
        <span class="sr-only">Block {index+1}</span>
      </div>{/if}
    </section>
  {/each}
  {#if blocks.length<minItems}<p role="alert">Add at least {minItems} blocks.</p>{/if}
</div>
<style>.blocks-field{display:grid;gap:12px}header{display:flex;flex-wrap:wrap;align-items:center;gap:8px}section,.picker{border:1px solid #c4cedd;border-radius:8px;padding:12px}.fields{display:grid;gap:16px;border-block-start:1px solid #d9e0eb;margin-block-start:12px;padding-block-start:12px}.summary{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.picker button span{display:block}.dragging{opacity:.5}.sr-only{position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%)}:global([dir=rtl] .rtl\:-scale-x-100){transform:scaleX(-1)}</style>
