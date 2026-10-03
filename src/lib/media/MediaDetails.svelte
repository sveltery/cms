<script lang="ts">
 import {onDestroy,untrack} from 'svelte';
 import MediaDialog from './MediaDialog.svelte';
 import MediaCropDialog from './MediaCropDialog.svelte';
 import {mediaHref,mediaRequest,uploadMediaFile,MediaRequestError} from './client';
 import {getImageDimensions} from './source/api/media';
 import {getMediaPreviewUrl} from './source/media-utils';
 import {normalizeCropMime} from './source/crop-mime';
 import type {MediaItem} from './types';
 let {item,permissions=[],actorId='',embedded=false,context='library',canDuplicateCrop=true,canReplaceOriginal=true,onupdated,oncreated,onunavailable,onback,onclose}: {
  item:MediaItem;permissions?:readonly string[];actorId?:string;embedded?:boolean;context?:'library'|'content';canDuplicateCrop?:boolean;canReplaceOriginal?:boolean;
  onupdated?:(item:MediaItem)=>void;oncreated?:(item:MediaItem)=>void;onunavailable?:(id:string)=>void;onback?:()=>void;onclose:()=>void;
 }=$props();
 let selected=$state<MediaItem>(untrack(()=>item)),alt=$state(untrack(()=>item.alt??'')),caption=$state(untrack(()=>item.caption??'')),focalX=$state<number|undefined>(untrack(()=>item.focalX??undefined)),focalY=$state<number|undefined>(untrack(()=>item.focalY??undefined));
 let currentId=untrack(()=>item.id);
 let busy=$state(false),message=$state(''),cropOpen=$state(false),unavailable=$state(false);
 let replacement=$state<{file:File;dimensions:{width:number;height:number}}|null>(null),replacementInput=$state<HTMLInputElement>();
 let inspectionToken=0,inspectionController:AbortController|undefined;
 const cancelInspection=()=>{inspectionToken++;inspectionController?.abort();};
 onDestroy(cancelInspection);
 $effect(()=>{selected=item;if(item.id!==currentId){currentId=item.id;alt=item.alt??'';caption=item.caption??'';focalX=item.focalX??undefined;focalY=item.focalY??undefined;message='';unavailable=false;cropOpen=false;replacement=null;cancelInspection();}});
 const canEdit=$derived(permissions.includes('media:edit_any')||(permissions.includes('media:edit_own')&&actorId!==''&&selected.authorId===actorId));
 const canDelete=$derived(context==='library'&&(permissions.includes('media:delete_any')||(permissions.includes('media:delete_own')&&actorId!==''&&selected.authorId===actorId)));
 const canUpload=$derived(permissions.includes('media:upload'));
 const dirty=$derived(alt!==(selected.alt??'')||caption!==(selected.caption??'')||focalX!==(selected.focalX??undefined)||focalY!==(selected.focalY??undefined));
 const canReplace=$derived(canReplaceOriginal&&canEdit&&selected.status==='ready'&&['image/jpeg','image/png','image/webp'].includes(normalizeCropMime(selected.mimeType)));
 const preview=$derived(mediaHref(getMediaPreviewUrl(selected.url,selected.contentHash)));
 const size=(bytes:number|null)=>bytes===null?'Unknown':bytes<1024?`${bytes} B`:`${(bytes/1024).toFixed(1)} KB`;
 function failed(cause:unknown){message=cause instanceof Error?cause.message:'Media request failed';if(cause instanceof MediaRequestError&&cause.status===404){unavailable=true;onunavailable?.(selected.id);}}
 async function save(){if(busy||!canEdit||unavailable)return;busy=true;message='';const id=selected.id;
  try{const result=await mediaRequest<{item:MediaItem}>(`/api/media/${encodeURIComponent(id)}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({alt,caption,focalX:focalX??null,focalY:focalY??null})});if(item.id===id){selected={...result.item,url:result.item.url||selected.url};onupdated?.(selected);message='Media details saved';}}
  catch(cause){if(item.id===id)failed(cause);}finally{busy=false;}
 }
 async function remove(){if(busy||!canDelete||unavailable||!confirm(`Delete ${selected.filename}?`))return;busy=true;message='';const id=selected.id;
  try{const result=await mediaRequest<{storageDeleted:boolean}>(`/api/media/${encodeURIComponent(id)}`,{method:'DELETE'});if(item.id===id){unavailable=true;message=result.storageDeleted?'Media deleted':'Media deleted; stored file cleanup is pending';onunavailable?.(id);if(embedded&&onback)onback();else onclose();}}
  catch(cause){if(item.id===id)failed(cause);}finally{busy=false;}
 }
 async function create(file:File){if(busy||dirty||!canUpload||!canDuplicateCrop||unavailable)throw new Error('Media upload is unavailable');busy=true;const id=selected.id;
  try{const copy=await uploadMediaFile(file,{deduplicate:false,ensureUniqueFilename:true,folderId:selected.folderId??null});if(item.id===id){cropOpen=false;message='Cropped copy created';oncreated?.(copy);}}
  finally{busy=false;}
 }
 async function inspectReplacement(event:Event){
  const input=event.currentTarget as HTMLInputElement,file=input.files?.[0];input.value='';
  if(!file||busy||dirty||cropOpen||!canReplace||unavailable)return;
  cancelInspection();const token=inspectionToken,id=selected.id;inspectionController=new AbortController();replacement=null;message='';
  if(file.size===0||normalizeCropMime(file.type)!==normalizeCropMime(selected.mimeType)){message='Choose a non-empty image matching the original file type.';return;}
  const dimensions=await getImageDimensions(file,{signal:inspectionController.signal}).catch(()=>null);
  if(token!==inspectionToken||item.id!==id)return;
  if(!dimensions){message='The selected image could not be read.';return;}
  replacement={file,dimensions};
 }
 async function replace(){
  if(!replacement||busy||dirty||!canReplace||unavailable)return;
  busy=true;message='Replacing image…';const id=selected.id,form=new FormData();
  form.append('file',replacement.file);form.append('width',String(replacement.dimensions.width));form.append('height',String(replacement.dimensions.height));
  try{const result=await mediaRequest<{item:MediaItem}>(`/api/media/${encodeURIComponent(id)}/replace`,{method:'PUT',body:form});if(item.id===id){selected=result.item;alt=result.item.alt??'';caption=result.item.caption??'';focalX=result.item.focalX??undefined;focalY=result.item.focalY??undefined;replacement=null;cropOpen=false;onupdated?.(result.item);message='Image replaced.';}}
  catch(cause){if(item.id===id)failed(cause);}finally{busy=false;}
 }
</script>
{#snippet details()}
 <header><h2>Media details</h2><div>{#if onback}<button disabled={busy} onclick={onback}>Back</button>{/if}<button disabled={busy} aria-label="Close media details" onclick={onclose}>Close</button></div></header>
 {#if unavailable}<p role="alert">This media file is no longer available.</p>{:else}
  {#if selected.mimeType.startsWith('image/')}<img class="preview" src={preview} alt={selected.alt??selected.filename} />{/if}
  <p>{selected.filename} · {size(selected.size)} · {selected.width??'—'} × {selected.height??'—'}</p>
  {#if canUpload&&canDuplicateCrop&&selected.status==='ready'&&['image/jpeg','image/png','image/webp'].includes(selected.mimeType)}<button disabled={busy||dirty} onclick={()=>{cancelInspection();replacement=null;cropOpen=true;}}>Crop image</button>{/if}
  {#if canReplace}<button disabled={busy||dirty} onclick={()=>{cancelInspection();replacement=null;message='';replacementInput?.click();}}>Replace image</button><input hidden type="file" accept={normalizeCropMime(selected.mimeType)} aria-label="Choose replacement image" bind:this={replacementInput} onchange={event=>void inspectReplacement(event)} />{/if}
  <form onsubmit={event=>{event.preventDefault();void save();}}><label>Alt text<input readonly={!canEdit||busy} bind:value={alt} /></label><label>Caption<textarea readonly={!canEdit||busy} bind:value={caption}></textarea></label><fieldset disabled={!canEdit||busy}><legend>Focal point</legend><label>Horizontal focal point<input type="number" min="0" max="1" step="0.01" bind:value={focalX} /></label><label>Vertical focal point<input type="number" min="0" max="1" step="0.01" bind:value={focalY} /></label></fieldset>{#if canEdit}<button disabled={busy}>Save changes</button>{/if}{#if canDelete}<button type="button" disabled={busy} onclick={()=>void remove()}>Delete media</button>{/if}</form>
 {/if}
 {#if message}<p role="status">{message}</p>{/if}
{/snippet}
{#if embedded}<section aria-label="Media details">{@render details()}</section>{:else}<MediaDialog label="Media details" dismissible={!busy} {onclose}>{@render details()}</MediaDialog>{/if}
{#if cropOpen&&!unavailable}<MediaCropDialog item={selected} src={preview} oncreate={create} onclose={()=>cropOpen=false} />{/if}
{#if replacement&&!unavailable}<MediaDialog label="Replace original image?" role="alertdialog" dismissible={!busy} onclose={()=>replacement=null}><h2>Replace original image?</h2><p>Every place using this image will update to the selected version.</p><button disabled={busy||dirty} onclick={()=>void replace()}>Replace image</button><button disabled={busy} onclick={()=>replacement=null}>Cancel</button></MediaDialog>{/if}
<style>header,header>div{display:flex;align-items:center;justify-content:space-between;gap:.5rem}header{margin:1rem 0}.preview{width:100%;max-height:300px;object-fit:contain}form,label{display:grid;gap:.4rem}form{gap:1rem}fieldset{display:flex;gap:1rem;border:1px solid #dfe3e9;border-radius:.5rem}fieldset label{flex:1}input,textarea,button{font:inherit;padding:.65rem;border:1px solid #c8ced8;border-radius:.5rem}button{cursor:pointer;background:white;color:inherit}button:disabled{cursor:default;opacity:.5}@media(max-width:600px){fieldset{flex-direction:column}}</style>
