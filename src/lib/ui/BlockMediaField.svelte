<script lang="ts">
 import {base} from '$app/paths';
 import type {MediaItem} from '$lib/media/types';
 let {id,label,value,onchange,readOnly=false,image=false}:{id:string;label:string;value:unknown;onchange:(value:unknown)=>void;readOnly?:boolean;image?:boolean}=$props();
 let open=$state(false),items=$state<MediaItem[]>([]),query=$state(''),page=$state(1),total=$state(0),message=$state(''),loading=$state(false);
 const current=$derived.by(()=>{if(typeof value==='string')return value;if(!value||typeof value!=='object')return '';const media=value as Record<string,unknown>,meta=media.meta&&typeof media.meta==='object'?media.meta as Record<string,unknown>:undefined;return (media.provider??'local')==='local'&&typeof meta?.storageKey==='string'?`/_emdash/api/media/file/${meta.storageKey}`:String(media.src??media.url??media.previewUrl??'');});
 const local=$derived(Boolean(value&&typeof value==='object'&&((value as Record<string,unknown>).provider??'local')==='local'));
 function replacePrimary(next:Record<string,unknown>){const dark=value&&typeof value==='object'&&'darkVariant' in value?value.darkVariant:undefined;onchange(dark?{...next,darkVariant:dark}:next);}
 const mime=$derived(value&&typeof value==='object'&&'mimeType'in value?String(value.mimeType??''):'');
 async function load(){loading=true;message='';try{const params=new URLSearchParams({q:query,page:String(page),limit:'50'});if(image)params.set('mimeType','image/');const response=await fetch(`${base}/api/media?${params}`),result=await response.json();if(!response.ok||!result.success)throw new Error(result.error?.message??'Media library is unavailable');items=result.data.items;total=result.data.totalCount??0;}catch(cause){message=cause instanceof Error?cause.message:'Media could not load';}finally{loading=false;}}
 function select(item:MediaItem){replacePrimary({provider:'local',id:item.id,filename:item.filename,alt:item.alt??'',...(item.width!==null?{width:item.width}:{}),...(item.height!==null?{height:item.height}:{}),mimeType:item.mimeType,meta:{storageKey:item.storageKey}});open=false;}
</script>
<div><label for={id}>{label}</label><input {id} type={local?'text':'url'} value={current} readonly={readOnly||local} oninput={event=>{if(event.currentTarget.value)replacePrimary({provider:'external',id:'',src:event.currentTarget.value,...(mime?{mimeType:mime}:{})});else onchange(null);}} />
 {#if value&&typeof value==='object'&&'provider'in value&&value.provider==='external'&&!image}<label>MIME type<input value={mime} readonly={readOnly} oninput={event=>onchange({...value as Record<string,unknown>,mimeType:event.currentTarget.value})}/></label>{/if}
 {#if current&&image}<img src={current.startsWith('/')?`${base}${current}`:current} alt="" loading="lazy" />{/if}
 {#if !readOnly}<button type="button" onclick={()=>{open=!open;if(open)void load();}}>Choose from media library</button>{#if value}<button type="button" onclick={()=>onchange(null)}>Remove {image?'image':'file'}</button>{/if}{/if}
 {#if open}<section aria-label={`Choose ${label}`}><label>Search media<input type="search" bind:value={query} oninput={()=>{page=1;void load();}} /></label>
  {#if loading}<p role="status">Loading media…</p>{/if}{#if message}<p role="alert">{message}</p>{/if}
  {#each items as item(item.id)}<button type="button" onclick={()=>select(item)}>{item.filename}</button>{/each}
  <button type="button" disabled={page===1||loading} onclick={()=>{page--;void load();}}>Previous page</button><button type="button" disabled={page*50>=total||loading} onclick={()=>{page++;void load();}}>Next page</button><button type="button" onclick={()=>open=false}>Cancel</button>
 </section>{/if}
</div>
<style>label{display:block;margin-block-end:6px}input{inline-size:100%;padding:8px;font:inherit}img{max-inline-size:240px;max-block-size:180px;display:block;margin-block:12px}section{border:1px solid #c4cedd;padding:12px}button{margin:6px;padding:8px}</style>
