<script lang="ts">
 import {base} from '$app/paths';
 import MediaPickerModal from '$lib/media/MediaPickerModal.svelte';
 import type {MediaItem} from '$lib/media/picker-client';
 import {getMediaObjectPosition} from '$lib/media/source/picker-media-utils';
 import {mediaDisplayUrl,mediaItemToImageFieldValue,selectFileField,type ImageFieldValue} from '$lib/blocks/media-values';
 let {id,label,value,onchange,readOnly=false,image=false,allowedMimeTypes}:{id:string;label:string;value:unknown;onchange:(value:unknown)=>void;readOnly?:boolean;image?:boolean;allowedMimeTypes?:string[]}=$props();
 let open=$state(false);
 const current=$derived(mediaDisplayUrl(value as ImageFieldValue|string|undefined)??'');
 const local=$derived(Boolean(value&&typeof value==='object'&&((value as Record<string,unknown>).provider??'local')==='local'));
 const objectPosition=$derived(value&&typeof value==='object'?getMediaObjectPosition(value):undefined);
 function replacePrimary(next:ImageFieldValue){const dark=value&&typeof value==='object'&&'darkVariant' in value?value.darkVariant:undefined;onchange(dark?{...next,darkVariant:dark}:next);}
 const mime=$derived(value&&typeof value==='object'&&'mimeType'in value?String(value.mimeType??''):'');
 function select(item:MediaItem){if(image)replacePrimary(mediaItemToImageFieldValue(item));else selectFileField(onchange)(item);}
</script>
<div><label for={id}>{label}</label><input {id} type={local?'text':'url'} value={current} readonly={readOnly||local} oninput={event=>{if(event.currentTarget.value)replacePrimary({provider:'external',id:'',src:event.currentTarget.value,...(mime?{mimeType:mime}:{})});else onchange(null);}} />
 {#if value&&typeof value==='object'&&'provider'in value&&value.provider==='external'&&!image}<label>MIME type<input value={mime} readonly={readOnly} oninput={event=>onchange({...value as Record<string,unknown>,mimeType:event.currentTarget.value})}/></label>{/if}
 {#if current&&image}<img src={current.startsWith('/')?`${base}${current}`:current} alt="" loading="lazy" style:object-position={objectPosition} />{/if}
 {#if !readOnly}<button type="button" onclick={()=>open=true}>Choose from media library</button>{#if value}<button type="button" onclick={()=>onchange(null)}>Remove {image?'image':'file'}</button>{/if}{/if}
 <MediaPickerModal {open} onOpenChange={next=>open=next} onSelect={select} mediaKind={image?'image':'file'} mimeTypeFilter={image?'image/':''} mimeTypeFilters={allowedMimeTypes} confirmLabel={`Use selected ${image?'image':'file'}`} title={`Choose ${label}`}/>
</div>
<style>label{display:block;margin-block-end:6px}input{inline-size:100%;padding:8px;font:inherit}img{max-inline-size:240px;max-block-size:180px;display:block;margin-block:12px}button{margin:6px;padding:8px}</style>
