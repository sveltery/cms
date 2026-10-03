<script lang="ts">
 import {base} from '$app/paths';
 import {onMount,untrack} from 'svelte';
 import MediaDialog from './MediaDialog.svelte';
 import MediaCropDialog from './MediaCropDialog.svelte';
 import {computeContentHash,MAX_CONTENT_HASH_BYTES} from './hash';
 import type {MediaItem,MediaFolder} from './types';
 let {initialItems=[],initialTotal=0,permissions=[],actorId='',onselect}: {initialItems?:MediaItem[];initialTotal?:number;permissions?:readonly string[];actorId?:string;onselect?:(item:MediaItem)=>void}=$props();
 let items=$state<MediaItem[]>(untrack(()=>initialItems)),folders=$state<MediaFolder[]>([]),total=$state(untrack(()=>initialTotal)),view=$state<'grid'|'list'>('grid');
 let search=$state(''),mimeType=$state(''),folderId=$state<string|undefined>(),page=$state(1),loading=$state(false),message=$state('');
 let uploadOpen=$state(false),uploading=$state(false),uploadState=$state(''),folderOpen=$state(false),folderName=$state('');
 let selected=$state<MediaItem|null>(null),alt=$state(''),caption=$state(''),focalX=$state<number|undefined>(),focalY=$state<number|undefined>(),saving=$state(false);
 let cropOpen=$state(false);
 let editingFolder=$state<MediaFolder|null>(null),editingFolderName=$state('');let requestId=0;
 const canUpload=$derived(permissions.includes('media:upload')),canOrganize=$derived(permissions.includes('media:edit_any'));
 const canEdit=$derived(permissions.includes('media:edit_any')||(permissions.includes('media:edit_own')&&selected?.authorId===actorId));
 const canDelete=$derived(permissions.includes('media:delete_any')||(permissions.includes('media:delete_own')&&selected?.authorId===actorId));
 const href=(url:string)=>url.startsWith('/')?`${base}${url}`:url;
 async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const response=await fetch(href(path),options);const result=await response.json();
  if(!response.ok||!result.success)throw new Error(result.error?.message??'Media request failed');return result.data;
 }
 async function load(){
  const id=++requestId;loading=true;message='';
  try{const query=new URLSearchParams({page:String(page),limit:'50'});if(search)query.set('q',search);if(mimeType)query.set('mimeType',mimeType);if(folderId)query.set('folderId',folderId);
   const result=await api<{items:MediaItem[];totalCount:number}>(`/api/media?${query}`);if(id===requestId){items=result.items;total=result.totalCount;}
  }catch(cause){if(id===requestId)message=cause instanceof Error?cause.message:'Media library could not load';}
  finally{if(id===requestId)loading=false;}
 }
 async function loadFolders(){
  try{
   const all:MediaFolder[]=[];let cursor:string|undefined;
   do{
    const query=new URLSearchParams({limit:'100'});if(cursor)query.set('cursor',cursor);
    const result=await api<{items:MediaFolder[];nextCursor?:string}>(`/api/media/folders?${query}`);
    all.push(...result.items);cursor=result.nextCursor;
   }while(cursor);
   folders=all;
  }catch(cause){message=cause instanceof Error?cause.message:'Folders could not load';}
 }
 onMount(()=>{void loadFolders();});
 async function uploadFile(file:File,options?:{deduplicate?:boolean;ensureUniqueFilename?:boolean;folderId:string|null}){
  const contentHash=options?.deduplicate!==false&&file.size<=MAX_CONTENT_HASH_BYTES?await computeContentHash(await file.arrayBuffer()):undefined;
  const pending=await api<{uploadUrl:string;method:'PUT';headers:Record<string,string>;mediaId:string;existing?:boolean}>('/api/media/upload-url',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({filename:file.name,contentType:file.type||'application/octet-stream',size:file.size,contentHash,...(options?.deduplicate===false?{deduplicate:false}:{}),...(options?.ensureUniqueFilename?{ensureUniqueFilename:true}:{}),...(options?{folderId:options.folderId}:folderId&&folderId!=='unfiled'?{folderId}:{})})});
  if(pending.existing)return;
  const response=await fetch(href(pending.uploadUrl),{method:pending.method,headers:pending.headers,body:file});
  if(!response.ok){let failure;try{failure=await response.json();}catch{/* External storage may return a non-JSON error. */}throw new Error(failure?.error?.message??'File upload failed');}
  await api(`/api/media/${pending.mediaId}/confirm`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
 }
 async function uploadFiles(files:FileList|null){
  if(!files?.length)return;uploading=true;uploadState='Uploading';message='';
  try{for(const file of files)await uploadFile(file);uploadState='Complete';page=1;await load();}
  catch(cause){uploadState='Upload failed';message=cause instanceof Error?cause.message:'Upload failed';}
  finally{uploading=false;}
 }
 async function createCroppedCopy(file:File){if(!selected)throw new Error('Media selection is no longer available');await uploadFile(file,{deduplicate:false,ensureUniqueFilename:true,folderId:selected.folderId??null});await load();cropOpen=false;selected=null;message='Cropped copy created';}
 function open(item:MediaItem){if(onselect){onselect(item);return;}selected=item;alt=item.alt??'';caption=item.caption??'';focalX=item.focalX??undefined;focalY=item.focalY??undefined;}
 async function save(){if(!selected)return;saving=true;message='';
  try{const result=await api<{item:MediaItem}>(`/api/media/${selected.id}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({alt,caption,focalX:focalX??null,focalY:focalY??null})});selected={...result.item,url:selected.url};await load();message='Media details saved';}
  catch(cause){message=cause instanceof Error?cause.message:'Media details could not save';}finally{saving=false;}
 }
 async function remove(){if(!selected||!confirm(`Delete ${selected.filename}?`))return;saving=true;message='';
  try{const result=await api<{storageDeleted:boolean}>(`/api/media/${selected.id}`,{method:'DELETE'});selected=null;await load();message=result.storageDeleted?'Media deleted':'Media deleted; stored file cleanup is pending';}
  catch(cause){message=cause instanceof Error?cause.message:'Media could not be deleted';}finally{saving=false;}
 }
 async function createFolder(){message='';try{await api('/api/media/folders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:folderName})});folderOpen=false;folderName='';await loadFolders();}catch(cause){message=cause instanceof Error?cause.message:'Folder could not be created';}}
 async function renameFolder(){if(!editingFolder)return;try{await api(`/api/media/folders/${editingFolder.id}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({name:editingFolderName})});editingFolder=null;await loadFolders();}catch(cause){message=cause instanceof Error?cause.message:'Folder could not be renamed';}}
 async function deleteFolder(folder:MediaFolder){if(!confirm(`Delete folder ${folder.name}? Media files will stay in the library.`))return;try{await api(`/api/media/folders/${folder.id}`,{method:'DELETE'});if(folderId===folder.id)folderId=undefined;await loadFolders();await load();}catch(cause){message=cause instanceof Error?cause.message:'Folder could not be deleted';}}
 async function move(item:MediaItem,target:string){try{await api(`/api/media/${item.id}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({folderId:target==='unfiled'?null:target})});await load();}catch(cause){message=cause instanceof Error?cause.message:'Media could not be moved';}}
 function drop(event:DragEvent,target:string){event.preventDefault();const id=event.dataTransfer?.getData('text/plain');const item=items.find(item=>item.id===id);if(item)void move(item,target);}
 const size=(bytes:number|null)=>bytes===null?'Unknown':bytes<1024?`${bytes} B`:`${(bytes/1024).toFixed(1)} KB`;
</script>
<header><h1>Media Library</h1>{#if canUpload}<button onclick={()=>{uploadOpen=true;uploadState='';}}>Upload</button>{/if}</header>
<form class="filters" onsubmit={event=>{event.preventDefault();page=1;void load();}}>
 <label>Search media<input type="search" bind:value={search} placeholder="Search by filename" /></label>
 <label>File type<select bind:value={mimeType} onchange={()=>{page=1;void load();}}><option value="">All files</option><option value="image/">Images</option><option value="video/">Videos</option><option value="audio/">Audio</option><option value="application/pdf">PDF documents</option></select></label>
 <button type="submit">Search</button>
</form>
<div class="toolbar"><div role="tablist" aria-label="Media view"><button role="tab" aria-selected={view==='grid'} onclick={()=>view='grid'}>Grid view</button><button role="tab" aria-selected={view==='list'} onclick={()=>view='list'}>List view</button></div>{#if canOrganize}<button onclick={()=>folderOpen=true}>Add new folder</button>{/if}</div>
<nav aria-label="Media folders" class="folders">
 <button aria-current={folderId===undefined?'page':undefined} onclick={()=>{folderId=undefined;page=1;void load();}}>All media</button>
 <button aria-current={folderId==='unfiled'?'page':undefined} ondragover={event=>event.preventDefault()} ondrop={event=>drop(event,'unfiled')} onclick={()=>{folderId='unfiled';page=1;void load();}}>Main folder</button>
 {#each folders as folder}<div><button aria-current={folderId===folder.id?'page':undefined} ondragover={event=>event.preventDefault()} ondrop={event=>drop(event,folder.id)} onclick={()=>{folderId=folder.id;page=1;void load();}}>{folder.name}</button>{#if canOrganize}<button aria-label={`Rename folder ${folder.name}`} onclick={()=>{editingFolder=folder;editingFolderName=folder.name;}}>Rename</button><button aria-label={`Delete folder ${folder.name}`} onclick={()=>void deleteFolder(folder)}>Delete</button>{/if}</div>{/each}
</nav>
{#if message}<p role="status">{message}</p>{/if}
{#if loading}<p role="status">Loading media…</p>{/if}
{#if !items.length&&!loading}<p>No media files found.</p>{/if}
{#if view==='grid'}<div data-media-grid class="grid" aria-label="Media files">
 {#each items as item}<button class="card" draggable={canOrganize} ondragstart={event=>event.dataTransfer?.setData('text/plain',item.id)} onclick={()=>open(item)} aria-label={item.filename}>{#if item.mimeType.startsWith('image/')}<img src={href(item.url)} alt={item.alt??item.filename} loading="lazy" style:background={item.dominantColor??'transparent'} />{:else}<span class="file-type">{item.mimeType}</span>{/if}<span>{item.filename}</span></button>{/each}
</div>{:else}<table><thead><tr><th>Name</th><th>Dimensions</th><th>Size</th><th>Created</th><th>Folder</th></tr></thead><tbody>{#each items as item}<tr><td><button onclick={()=>open(item)}>{item.filename}</button></td><td>{item.width??'—'} × {item.height??'—'}</td><td>{size(item.size)}</td><td>{new Date(item.createdAt).toLocaleDateString()}</td><td>{folders.find(folder=>folder.id===item.folderId)?.name??'Main folder'}</td></tr>{/each}</tbody></table>{/if}
<div class="pagination"><button disabled={page===1||loading} onclick={()=>{page--;void load();}}>Previous page</button><span>Page {page} · {total} files</span><button disabled={page*50>=total||loading} onclick={()=>{page++;void load();}}>Next page</button></div>
{#if uploadOpen}<MediaDialog label="Upload media" dismissible={!uploading} onclose={()=>uploadOpen=false}><h2>Upload media</h2><label>Browse files to upload<input type="file" multiple disabled={uploading} onchange={event=>void uploadFiles(event.currentTarget.files)} /></label><p role="status">{uploadState}</p>{#if message}<p role="alert">{message}</p>{/if}<button disabled={uploading} onclick={()=>uploadOpen=false}>Done</button></MediaDialog>{/if}
{#if selected}<MediaDialog label="Media details" onclose={()=>selected=null}><header><h2>Media details</h2><button aria-label="Close media details" onclick={()=>selected=null}>Close</button></header>{#if selected.mimeType.startsWith('image/')}<img class="preview" src={href(selected.url)} alt={selected.alt??selected.filename} />{/if}<p>{selected.filename} · {size(selected.size)} · {selected.width??'—'} × {selected.height??'—'}</p>{#if canUpload&&['image/jpeg','image/png','image/webp'].includes(selected.mimeType)}<button onclick={()=>cropOpen=true}>Crop image</button>{/if}<form onsubmit={event=>{event.preventDefault();void save();}}><label>Alt text<input readonly={!canEdit} bind:value={alt} /></label><label>Caption<textarea readonly={!canEdit} bind:value={caption}></textarea></label><fieldset disabled={!canEdit}><legend>Focal point</legend><label>Horizontal focal point<input type="number" min="0" max="1" step="0.01" bind:value={focalX} /></label><label>Vertical focal point<input type="number" min="0" max="1" step="0.01" bind:value={focalY} /></label></fieldset>{#if canEdit}<button disabled={saving}>Save changes</button>{/if}{#if canDelete}<button type="button" disabled={saving} onclick={()=>void remove()}>Delete media</button>{/if}</form>{#if message}<p role="status">{message}</p>{/if}</MediaDialog>{/if}
{#if cropOpen&&selected}<MediaCropDialog item={selected} src={href(selected.url)} oncreate={createCroppedCopy} onclose={()=>cropOpen=false} />{/if}
{#if folderOpen}<MediaDialog label="Add new folder" onclose={()=>folderOpen=false}><h2>Add new folder</h2><form onsubmit={event=>{event.preventDefault();void createFolder();}}><label>Name<input bind:value={folderName} required /></label><button>Create</button><button type="button" onclick={()=>folderOpen=false}>Cancel</button></form>{#if message}<p role="alert">{message}</p>{/if}</MediaDialog>{/if}
{#if editingFolder}<MediaDialog label="Rename folder" onclose={()=>editingFolder=null}><h2>Rename folder</h2><form onsubmit={event=>{event.preventDefault();void renameFolder();}}><label>Name<input bind:value={editingFolderName} required /></label><button>Save</button><button type="button" onclick={()=>editingFolder=null}>Cancel</button></form></MediaDialog>{/if}
<style>
 header,.toolbar,.pagination{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:1rem 0}.filters{display:flex;gap:1rem;align-items:end;flex-wrap:wrap}label{display:flex;flex-direction:column;gap:.4rem}input,select,textarea,button{font:inherit;padding:.65rem;border:1px solid #c8ced8;border-radius:.5rem}button{cursor:pointer;background:white;color:inherit}button:disabled{cursor:default;opacity:.5}button[aria-selected=true],button[aria-current=page]{background:#edf1ff;border-color:#8ca5ed}.folders{display:flex;gap:.5rem;flex-wrap:wrap;margin:1rem 0}.folders>div{display:flex;gap:.3rem}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:1rem}.card{display:flex;flex-direction:column;gap:.5rem;overflow:hidden;text-align:left}.card img{width:100%;aspect-ratio:1;object-fit:contain}.card>span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.file-type{display:grid;min-height:130px;place-items:center;font-size:.8rem}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:.6rem;border-bottom:1px solid #dde2e9}.preview{width:100%;max-height:300px;object-fit:contain}form:not(.filters){display:grid;gap:1rem}fieldset{display:flex;gap:1rem;border:1px solid #dfe3e9;border-radius:.5rem}fieldset label{flex:1}@media(max-width:600px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.filters>*{width:100%}table{display:block;overflow:auto}fieldset{flex-direction:column}.pagination{flex-wrap:wrap}}
</style>
