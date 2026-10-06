<script lang="ts">
 import {flushSync,onDestroy,untrack,type Snippet} from 'svelte';
 import MediaPickerItem from './MediaPickerItem.svelte';
 import MediaDetails from './MediaDetails.svelte';
 import {mediaPermissionsForUser} from './permissions';
 import type {MediaItem as NativeMediaItem} from './types';
 import {nativeMediaPickerClient,fetchPickerCurrentUser,type MediaPickerClient,type MediaItem,type MediaProviderItem,type MediaProviderInfo,type MediaFolder} from './picker-client';
 import {URL_SOURCE,selectionKey,matchesAnyFilter,matchesFilenameSearch,intersectMimeFilters,filtersOverlap,appendUniqueSelections,withLocalMediaUrl,probeImageDimensions,type SelectedMedia,type UploadedMedia} from './picker-helpers';
 import {providerItemToMediaItem} from './source/picker-media-utils';
 import {mimeFromUrl,matchesMimeAllowlist} from './source/picker-mime';
 import {createPickerUploadQueue,type PickerUploadJob} from './picker-upload-queue';
 interface Props {
  open:boolean;onOpenChange:(open:boolean)=>void;onSelect:(item:MediaItem)=>void;
  multiple?:boolean;onSelectMany?:(items:MediaItem[])=>void;mimeTypeFilter?:string;mimeTypeFilters?:string[];
  title?:string;confirmLabel?:string;hideUrlInput?:boolean;mediaKind?:'image'|'file';fieldId?:string;localOnly?:boolean;
  client?:MediaPickerClient;currentUser?:{id:string;role:number};assetDetails?:Snippet<[Record<string,unknown>]>;
 }
 let {open,onOpenChange,onSelect,multiple=false,onSelectMany,mimeTypeFilter='image/',mimeTypeFilters,title:providedTitle,confirmLabel,hideUrlInput=false,mediaKind='image',fieldId,localOnly=false,client=nativeMediaPickerClient,currentUser,assetDetails}:Props=$props();
 const title=$derived(providedTitle??(mediaKind==='file'?'Select file':'Select image'));
 const filters=$derived(mimeTypeFilters!==undefined?(mimeTypeFilters.length?mimeTypeFilters:undefined):(mimeTypeFilter?[mimeTypeFilter]:undefined));
 let dialog=$state<HTMLDialogElement|undefined>(),fileInput=$state<HTMLInputElement|undefined>(),editButton=$state<HTMLButtonElement|undefined>();
 let restoreEditFocus=$state(false);
 let dismissed=$state(false),source=$state('local'),selected=$state<SelectedMedia[]>([]),pinned=$state<SelectedMedia[]>([]);
 let items=$state<MediaItem[]>([]),providerItems=$state<MediaProviderItem[]>([]),providers=$state<MediaProviderInfo[]>([]),folders=$state<MediaFolder[]>([]);
 let folderId=$state<string|undefined>(),folderName=$state('Folder'),folderCursor=$state<string|undefined>();
 let search=$state(''),activeSearch=$state(''),typeFilter=$state('all'),filterMenu=$state(false),view=$state<'grid'|'list'>('grid'),page=$state(1),total=$state(0),loading=$state(false),error=$state(''),folderError=$state(''),message=$state('');
 let imageUrl=$state(''),urlError=$state(''),probing=$state(false),assetItem=$state<MediaItem|null>(null),actor=$state<{id:string;role:number}|undefined>();
 let jobs=$state<PickerUploadJob<UploadedMedia>[]>([]),overflow=$state(0),refresh=$state(0);
 let requestId=0,folderRequestId=0,probeId=0,wasOpen=false,wasLocalOnly=untrack(()=>localOnly),orderEdited=false;
 const dimensionIds=new Set<string>(),targets=new Map<number,string>();
 const detected=new Map<string,{width:number;height:number}>();
 const hasUnfinished=$derived(jobs.some(job=>job.status==='queued'||job.status==='uploading'));
 const canUpload=$derived(source==='local'?!folderId:Boolean(providers.find(provider=>provider.id===source)?.capabilities.upload));
 const canSearch=$derived(source==='local'||Boolean(providers.find(provider=>provider.id===source)?.capabilities.search));
 const category=(value:string):string|string[]|undefined=>({image:'image/',video:'video/',audio:'audio/',document:['application/','text/']}[value]);
 const effectiveFilters=$derived(intersectMimeFilters(filters,category(typeFilter)));
 const urlAvailable=$derived(!hideUrlInput&&!localOnly&&(!filters||filters.some(filter=>filtersOverlap(filter,'image/'))));
 const sourceTabs=$derived([{id:'local',name:'Library'},...(!localOnly?providers.filter(provider=>provider.id!=='local'):[]),...(urlAvailable?[{id:URL_SOURCE,name:'From URL'}]:[])]);
 const typeOptions=$derived([{id:'all',name:'All types'},...([{id:'image',name:'Images'},{id:'video',name:'Video'},{id:'audio',name:'Audio'},{id:'document',name:'Documents'}].filter(option=>intersectMimeFilters(filters,category(option.id))?.length!==0))]);
 const lastPage=$derived(Math.max(1,Math.ceil(total/12)));
 const showFolders=$derived(source==='local'&&page===1&&typeFilter==='all'&&(!folderId||Boolean(activeSearch)));
 const visibleItems=$derived.by(()=>{
  const activeFilters=source==='local'?effectiveFilters:filters;
  const matching=pinned.filter(entry=>entry.providerId===source&&!(source==='local'&&folderId&&!activeSearch)&&activeFilters?.length!==0&&matchesAnyFilter(entry.item.mimeType,activeFilters)&&matchesFilenameSearch(entry.item.filename,source==='local'?activeSearch:search.trim()));
  const keys=new Set(matching.map(entry=>entry.key));
  const fetched=source==='local'?items:providerItems;
  return [...matching.map(entry=>entry.item),...fetched.filter(item=>!keys.has(selectionKey(source,item))&&activeFilters?.length!==0&&matchesAnyFilter(item.mimeType,activeFilters))];
 });
 const visibleJobs=$derived(jobs.filter(job=>job.status!=='complete'&&targets.get(job.id)===source));
 const confirmText=$derived(confirmLabel??(multiple?`Add ${selected.length} ${mediaKind==='file'?'file':'image'}${selected.length===1?'':'s'}`:'Select'));
 const detailsUser=$derived(currentUser??actor);
 const detailsPermissions=$derived(mediaPermissionsForUser(detailsUser));
 const editable=$derived.by(()=>{
  const user=currentUser??actor,entry=selected.length===1?selected[0]:undefined;
  if(!user||entry?.providerId!=='local'||!entry.item.mimeType.startsWith('image/'))return null;
  const item=entry.item as MediaItem&{authorId?:string|null};
  return user.role>=40||(user.role>=30&&item.authorId===user.id)?item:null;
 });
 const queue=createPickerUploadQueue<UploadedMedia>(async(file,options)=>{
  const providerId=targets.get(options.jobId);if(!providerId)throw new Error('Missing upload target');
  if(providerId==='local'){
   if(!client.uploadMedia)throw new Error('Media upload is unavailable');
   return {providerId,item:withLocalMediaUrl(await client.uploadMedia(file,{fieldId,signal:options.signal}))};
  }
  if(!client.uploadToProvider)throw new Error('Provider upload is unavailable');
  return {providerId,item:await client.uploadToProvider(providerId,file,undefined,{signal:options.signal})};
 },(next,count)=>{jobs=next;overflow=count;},completeUploads);
 function invalidateProbe(){probeId++;probing=false;}
 function reset(){
  restoreEditFocus=false;queue.reset();targets.clear();dimensionIds.clear();detected.clear();orderEdited=false;
  source='local';selected=[];pinned=[];items=[];providerItems=[];providers=[];folders=[];folderId=undefined;folderCursor=undefined;
  search='';activeSearch='';typeFilter='all';view='grid';page=1;total=0;imageUrl='';urlError='';error='';message='';assetItem=null;invalidateProbe();dismissed=false;
 }
 $effect(()=>{
  const nextOpen=open,nextLocalOnly=localOnly;
  if(nextOpen&&(!wasOpen||nextLocalOnly!==wasLocalOnly))untrack(()=>{
   reset();
   if(!nextLocalOnly&&client.fetchMediaProviders)void client.fetchMediaProviders().then(value=>{if(open&&!dismissed)providers=value;},cause=>{error=cause instanceof Error?cause.message:'Media providers could not load';});
   if(!currentUser)void fetchPickerCurrentUser().then(value=>actor=value,()=>actor=undefined);
  });
  if(!nextOpen)untrack(()=>{queue.reset();requestId++;folderRequestId++;invalidateProbe();restoreEditFocus=false;assetItem=null;});
  wasOpen=nextOpen;wasLocalOnly=nextLocalOnly;
 });
 $effect(()=>{
  if(open&&!dismissed&&dialog&&!dialog.open)dialog.showModal();
 });
 // Restore the retained action only after the details-to-picker DOM commit.
 $effect(()=>{
  if(!open||dismissed||assetItem||!restoreEditFocus)return;
  restoreEditFocus=false;editButton?.focus({preventScroll:true});
 });
 $effect(()=>{
  const value=search.trim().slice(0,200);
  if(!value){activeSearch='';return;}
  const timer=setTimeout(()=>activeSearch=value,300);return()=>clearTimeout(timer);
 });
 $effect(()=>{
  const active=open&&!dismissed,provider=source,query=activeSearch,requestedPage=page,mime=effectiveFilters,folder=folderId,providerSearch=source==='local'?'':search,revision=refresh;
  if(!active||provider===URL_SOURCE)return;
  untrack(()=>void loadMedia(provider,{page:requestedPage,limit:12,search:query||undefined,mimeType:mime,folderId:query?undefined:(folder??null)},providerSearch));
 });
 $effect(()=>{
  const active=open&&!dismissed&&showFolders,query=activeSearch;
  if(active)untrack(()=>void loadFolders(query));
 });
 $effect(()=>{
  const id=folderId;
  if(!open||dismissed||!id)return;
  const request=++folderRequestId;folderName='Folder';folderError='';
  if(client.fetchMediaFolder)void client.fetchMediaFolder(id).then(value=>{if(request===folderRequestId)folderName=value.name;},cause=>{
   if(request!==folderRequestId)return;
   if(cause&&typeof cause==='object'&&'code' in cause&&cause.code==='NOT_FOUND'){folderId=undefined;page=1;message='Folder no longer exists. Returned to the main library.';}
   else folderError='Could not load this folder.';
  });
 });
 async function loadMedia(provider:string,options:Parameters<MediaPickerClient['fetchMediaList']>[0],providerSearch:string){
  const request=++requestId;loading=true;error='';
  try{
   if(provider==='local'){
    if(options?.mimeType?.length===0){items=[];total=0;return;}
    const result=await client.fetchMediaList(options);if(request!==requestId)return;
    items=result.items;total=result.totalCount??result.items.length;
    const last=Math.max(1,Math.ceil(total/12));if(page>last){items=[];page=last;}
   }else{
    if(!client.fetchProviderMedia)throw new Error('Provider browsing is unavailable');
    const result=await client.fetchProviderMedia(provider,{limit:50,mimeType:filters,query:providerSearch.trim()||undefined});
    if(request===requestId)providerItems=result.items;
   }
  }catch(cause){if(request===requestId)error=cause instanceof Error?cause.message:'Media could not load';}
  finally{if(request===requestId)loading=false;}
 }
 async function loadFolders(query:string,cursor?:string){
  const result=await client.fetchMediaFolders({limit:100,cursor,search:query||undefined}).catch(cause=>{folderError=cause instanceof Error?cause.message:'Folders could not load';return undefined;});
  if(!result||!open||dismissed||query!==activeSearch)return;
  folders=cursor?[...folders,...result.items]:result.items;folderCursor=result.nextCursor;
 }
 function changeSource(id:string){if(hasUnfinished||id===source)return;invalidateProbe();source=id;search='';activeSearch='';page=1;providerItems=[];}
 function choose(item:MediaItem|MediaProviderItem,provider=source){
  invalidateProbe();const key=selectionKey(provider,item),exists=selected.some(entry=>entry.key===key);
  const next={key,providerId:provider,item};selected=exists?selected.filter(entry=>entry.key!==key):multiple?[...selected,next]:[next];
 }
 function toItem(entry:SelectedMedia):MediaItem{
  if(entry.providerId==='local'||entry.providerId===URL_SOURCE)return entry.item as MediaItem;
  const item=entry.item as MediaProviderItem,dimensions=detected.get(entry.key);
  return providerItemToMediaItem(entry.providerId,dimensions?{...item,width:item.width??dimensions.width,height:item.height??dimensions.height}:item);
 }
 function completeUploads(){
  const complete=jobs.filter((job):job is PickerUploadJob<UploadedMedia>&{result:UploadedMedia}=>job.status==='complete'&&job.result!==undefined);
  if(!complete.length)return;
  const additions=complete.map(job=>({key:selectionKey(job.result.providerId,job.result.item),providerId:job.result.providerId,item:job.result.item,uploadJobId:job.id}));
  pinned=appendUniqueSelections(pinned,additions);selected=multiple?appendUniqueSelections(selected,additions,!orderEdited):[additions.at(-1)!];
  for(const job of complete){targets.delete(job.id);queue.remove(job.id);}
  refresh++;
 }
 function enqueue(files:readonly File[]){
  if(!canUpload||!files.length)return;
  const compatible=filters?.length?files.filter(file=>matchesAnyFilter(file.type,filters)):[...files];
  const accepted=multiple?compatible:compatible.slice(0,1),added=queue.add(accepted);
  for(const job of added)targets.set(job.id,source);
  const count=files.length-accepted.length;if(count)message=`${count} file${count===1?' was':'s were'} not added.`;
 }
 function drop(event:DragEvent){if(!event.dataTransfer?.types.includes('Files'))return;event.preventDefault();if(canUpload)enqueue([...event.dataTransfer.files]);}
 function dragover(event:DragEvent){if(!event.dataTransfer?.types.includes('Files'))return;event.preventDefault();event.dataTransfer.dropEffect=canUpload?'copy':'none';}
 async function dimensions(item:MediaItem|MediaProviderItem,image:HTMLImageElement){
  if((item.width&&item.height)||!image.naturalWidth||!image.naturalHeight)return;
  const width=image.naturalWidth,height=image.naturalHeight,key=selectionKey(source,item);
  if(source!=='local'){detected.set(key,{width,height});return;}
  if(dimensionIds.has(item.id))return;dimensionIds.add(item.id);
  try{await client.updateMedia?.(item.id,{width,height});items=items.map(entry=>entry.id===item.id?{...entry,width,height}:entry);selected=selected.map(entry=>entry.providerId==='local'&&entry.item.id===item.id?{...entry,item:{...entry.item,width,height}}:entry);}
  catch(cause){console.warn('Failed to update media dimensions:',cause);}
 }
 async function submitUrl(){
  if(!imageUrl.trim())return;
  let url:URL;try{url=new URL(imageUrl.trim());}catch{urlError='Please enter a valid URL';return;}
  const request=++probeId;probing=true;urlError='';
  try{
   const mimeType=mimeFromUrl(url)??'image/unknown';
   if(mimeType==='image/unknown'&&filters?.length){urlError='Use a URL ending in a recognized image extension, such as .jpg or .png.';return;}
   if(filters?.length&&!matchesMimeAllowlist(mimeType,filters)){urlError=`This field does not accept ${mimeType} files.`;return;}
   const size=await probeImageDimensions(url.href,'Failed to load image');if(request!==probeId)return;
   const item:MediaItem={id:'',filename:url.pathname.split('/').pop()||'external-image',mimeType,url:url.href,provider:'external',size:0,width:size.width,height:size.height,createdAt:new Date().toISOString()};
   const key=selectionKey(URL_SOURCE,item);if(!selected.some(entry=>entry.key===key))selected=multiple?[...selected,{key,providerId:URL_SOURCE,item}]:[{key,providerId:URL_SOURCE,item}];imageUrl='';
  }catch{if(request===probeId)urlError='Could not load image from URL';}
  finally{if(request===probeId)probing=false;}
 }
 function changeImageUrl(event:Event){
  const value=(event.currentTarget as HTMLInputElement).value;
  // Match the Source input's synchronous change commit before a following
  // native click; keep the unmodified Source event/expectation sequence.
  flushSync(()=>{imageUrl=value;urlError='';});
 }
 function close(){restoreEditFocus=false;invalidateProbe();queue.reset();targets.clear();pinned=[];selected=[];assetItem=null;dismissed=true;onOpenChange(false);}
 function confirm(){if(!selected.length||hasUnfinished)return;const values=selected.map(entry=>$state.snapshot(toItem(entry)));if(multiple)onSelectMany?.(values);else onSelect(values[0]);close();}
 function move(from:number,to:number){if(to<0||to>=selected.length)return;orderEdited=true;const next=[...selected],entry=next.splice(from,1)[0];next.splice(to,0,entry);selected=next;message=`Moved ${entry.item.filename} to position ${to+1}.`;}
 function remove(entry:SelectedMedia){orderEdited=true;selected=selected.filter(item=>item.key!==entry.key);message=`Removed ${entry.item.filename} from selection.`;}
 function back(){restoreEditFocus=true;assetItem=null;}
 function refreshed(item:MediaItem){assetItem=item;items=items.map(entry=>entry.id===item.id?item:entry);selected=selected.map(entry=>entry.providerId==='local'&&entry.item.id===item.id?{...entry,item}:entry);pinned=pinned.map(entry=>entry.providerId==='local'&&entry.item.id===item.id?{...entry,item}:entry);}
 function cropped(item:MediaItem){const entry={key:selectionKey('local',item),providerId:'local',item};pinned=appendUniqueSelections(pinned,[entry]);selected=multiple?selected.map(value=>value.item.id===assetItem?.id?entry:value):[entry];assetItem=item;}
 // The real local API returns complete native rows, including nullable fields.
 // Keep those runtime values intact across the Source admin type-only boundary.
 function nativeRefreshed(item:NativeMediaItem){refreshed(item as unknown as MediaItem);}
 function nativeCropped(item:NativeMediaItem){cropped(item as unknown as MediaItem);}
 function unavailable(id:string){selected=selected.filter(entry=>entry.providerId!=='local'||entry.item.id!==id);pinned=pinned.filter(entry=>entry.providerId!=='local'||entry.item.id!==id);}
 const display=(item:MediaItem|MediaProviderItem)=>'url' in item?item as MediaItem:providerItemToMediaItem(source,item as MediaProviderItem);
 onDestroy(()=>{queue.reset();requestId++;folderRequestId++;invalidateProbe();});
</script>

{#if open&&!dismissed}
 <!-- svelte-ignore a11y_no_redundant_roles (Pinned asset handoff selects the explicit dialog role.) -->
 <dialog bind:this={dialog} role="dialog" aria-label={title} oncancel={event=>{event.preventDefault();if(assetItem)void back();else close();}}>
  {#if assetItem}
   {#if assetDetails}
    {@render assetDetails({open:true,item:assetItem,embedded:true,context:'content',canCropOriginal:Boolean(editable),canDuplicateCrop:((currentUser??actor)?.role??0)>=20,onClose:back,onExit:close,onItemRefreshed:refreshed,onCroppedCopyCreated:cropped,onUnavailable:unavailable})}
   {:else}
    <MediaDetails item={assetItem as unknown as NativeMediaItem} permissions={detailsPermissions} actorId={detailsUser?.id??''} embedded context="content" canDuplicateCrop={detailsPermissions.includes('media:upload')} onback={()=>void back()} onclose={close} onupdated={nativeRefreshed} oncreated={nativeCropped} onunavailable={unavailable} />
   {/if}
  {:else}
   <header><div><h2>{title}</h2><p>Choose {mediaKind==='file'?'a file':'an image'} from the library or upload a new one.</p></div><button type="button" aria-label="Close" onclick={close}>×</button></header>
   <div class="toolbar">
    <div role="tablist" aria-label="Media source">{#each sourceTabs as tab}<button type="button" role="tab" aria-selected={source===tab.id} disabled={hasUnfinished} onclick={()=>changeSource(tab.id)}>{tab.name}</button>{/each}</div>
    {#if canUpload}<button type="button" onclick={()=>fileInput?.click()}>Upload files</button><input bind:this={fileInput} type="file" class="file-input" aria-label="Choose files to upload" accept={filters?.map(filter=>filter.endsWith('/')?`${filter}*`:filter).join(',')} {multiple} onchange={event=>{enqueue([...(event.currentTarget.files??[])]);event.currentTarget.value='';}} />{/if}
   </div>
   {#if source===URL_SOURCE}
    <section class="url-input"><label>Image URL<input type="url" aria-label="Image URL" value={imageUrl} oninput={changeImageUrl} onchange={changeImageUrl} onkeydown={event=>{if(event.key==='Enter'){event.preventDefault();void submitUrl();}}} /></label><button type="button" disabled={!imageUrl.trim()||probing} onclick={()=>void submitUrl()}>Use URL</button>{#if urlError}<p role="alert">{urlError}</p>{/if}</section>
    {#each selected.filter(entry=>entry.providerId===URL_SOURCE) as entry}<button type="button" class="url-preview" aria-label={entry.item.filename} aria-pressed="true" onclick={event=>{if(event.detail<2)choose(entry.item,URL_SOURCE);}}><img src={(entry.item as MediaItem).url} alt="" />{entry.item.filename}</button>{/each}
   {:else}
    {#if folderId&&source==='local'}<nav aria-label="Current folder"><button type="button" disabled={hasUnfinished} onclick={()=>{folderId=undefined;page=1;}}>Main library</button><span aria-hidden="true">/</span><span>{folderName}</span></nav>{/if}
    <div class="filters">
     {#if canSearch}<label>Search media<input type="search" aria-label="Search media" maxlength="200" bind:value={search} oninput={()=>page=1} /></label>{/if}
     {#if source==='local'}<div class="type-filter"><button type="button" role="combobox" aria-label="Filter by type" aria-expanded={filterMenu} aria-controls="media-picker-type-options" onclick={()=>filterMenu=!filterMenu}>{typeOptions.find(option=>option.id===typeFilter)?.name??'All types'}</button>{#if filterMenu}<div id="media-picker-type-options" role="listbox" aria-label="Filter by type">{#each typeOptions as option}<button type="button" role="option" aria-selected={typeFilter===option.id} onclick={()=>{typeFilter=option.id;page=1;filterMenu=false;}}>{option.name}</button>{/each}</div>{/if}</div>{/if}
     <div role="tablist" aria-label="View mode"><button role="tab" type="button" aria-selected={view==='grid'} onclick={()=>view='grid'}>Grid view</button><button role="tab" type="button" aria-selected={view==='list'} onclick={()=>view='list'}>List view</button></div>
    </div>
    {#if folderError}<p role="alert">{folderError}</p>{/if}
    {#if showFolders&&folders.length}<section aria-label="Folders" class="folders">{#each folders as folder}<button type="button" aria-label={`Open folder ${folder.name}`} disabled={hasUnfinished} onclick={()=>{search='';activeSearch='';folderId=folder.id;page=1;}}>{folder.name}</button>{/each}{#if folderCursor}<button type="button" disabled={hasUnfinished} onclick={()=>void loadFolders(activeSearch,folderCursor)}>Load more folders</button>{/if}</section>{/if}
    <section aria-label="Media results" aria-busy={loading||undefined} ondragover={dragover} ondrop={drop} class="results">
     {#if error}<p role="alert">{error}</p><button type="button" onclick={()=>refresh++}>Retry</button>{/if}
     {#if overflow}<p role="alert">{overflow} file{overflow===1?' was':'s were'} not added because the upload list is full.</p>{/if}
     {#if loading&&!visibleItems.length&&!visibleJobs.length}<p role="status">Loading media</p>{/if}
     <div data-media-items class:grid={view==='grid'} class:list={view==='list'} inert={loading||undefined}>
      {#each visibleItems as item (selectionKey(source,item))}
       <MediaPickerItem item={display(item)} layout={view} selected={selected.some(entry=>entry.key===selectionKey(source,item))} onselect={event=>{if(event.detail<2&&!loading)choose(item);}} ondimensions={image=>void dimensions(item,image)}/>
      {/each}
      {#each visibleJobs as job (job.id)}<div class="upload-job" data-upload-status={job.status}><span>{job.file.name}</span><span>{job.status==='failed'?'Upload failed':job.status==='queued'?'Queued':'Uploading'}</span>{#if job.status==='failed'}<button type="button" aria-label={`Retry ${job.file.name}`} onclick={()=>queue.retry(job.id)}>Retry</button><button type="button" aria-label={`Remove ${job.file.name}`} onclick={()=>{targets.delete(job.id);queue.remove(job.id);}}>Remove</button>{/if}</div>{/each}
     </div>
     {#if !loading&&!error&&!visibleItems.length&&!visibleJobs.length}<p>{mediaKind==='file'?'No files in your library yet':'No images in your library yet'}</p><p>{mediaKind==='file'?'Upload a file to get started':'Upload an image to get started'}</p>{/if}
    </section>
    {#if source==='local'}<nav aria-label="Media pagination" class="pagination"><button type="button" aria-label="Previous page" disabled={page===1||loading} onclick={()=>page--}>Previous page</button><label>Page number<input aria-label="Page number" type="text" inputmode="numeric" value={String(page)} onchange={event=>{const value=Number(event.currentTarget.value);if(Number.isInteger(value)&&value>=1&&value<=lastPage)page=value;else event.currentTarget.value=String(page);}} /></label><span>of {lastPage}</span><button type="button" aria-label="Next page" disabled={page>=lastPage||loading} onclick={()=>page++}>Next page</button></nav>{/if}
   {/if}
   {#if multiple&&selected.length}<section aria-label="Selected media" class="selection"><h3>Selected media</h3><ul>{#each selected as entry,index (entry.key)}<li><span>{entry.item.filename}</span><span>{index+1} of {selected.length}</span><button type="button" aria-label={`Move ${entry.item.filename} earlier`} disabled={index===0} onclick={()=>move(index,index-1)}>↑</button><button type="button" aria-label={`Move ${entry.item.filename} later`} disabled={index===selected.length-1} onclick={()=>move(index,index+1)}>↓</button><button type="button" aria-label={`Remove ${entry.item.filename} from selection`} onclick={()=>remove(entry)}>Remove</button></li>{/each}</ul></section>{/if}
  {/if}
  <!-- Like the Source footer, retain the focus target while details hide the picker actions. -->
  <footer hidden={Boolean(assetItem)}>{#if editable}<button type="button" bind:this={editButton} disabled={hasUnfinished} onclick={()=>assetItem=editable}>Edit asset</button>{/if}<button type="button" onclick={close}>Cancel</button><button type="button" disabled={!selected.length||hasUnfinished} onclick={confirm}>{confirmText}</button></footer>
  <p role="status" class="announcement" aria-live="polite">{message}</p>
 </dialog>
{/if}
<style>
 dialog{box-sizing:border-box;width:min(94vw,68rem);height:min(48rem,94dvh);max-height:94dvh;border:1px solid #d8dce5;border-radius:1rem;padding:0;color:var(--color-text,#172033);background:var(--color-surface,#fff)}dialog::backdrop{background:#15203988}header,footer,.toolbar,.filters,.pagination{display:flex;align-items:center;gap:.6rem;padding:1rem 1.4rem}header{justify-content:space-between;border-bottom:1px solid #dde1e8}h2,p{margin:.25rem 0}header p{color:#626b7b;font-size:.9rem}.toolbar,.filters{flex-wrap:wrap}.toolbar>button{margin-left:auto}button,input{font:inherit;color:inherit;border:1px solid #cbd1dc;border-radius:.5rem;background:transparent;padding:.6rem .8rem}button{cursor:pointer}button:disabled{cursor:default;opacity:.5}button[aria-selected=true],button[aria-pressed=true]{border-color:#386de0;background:#edf3ff}button:focus-visible,input:focus-visible{outline:2px solid #386de0;outline-offset:2px}label{display:grid;gap:.3rem}.filters>label{flex:1}.filters input{min-width:8rem;width:100%;box-sizing:border-box}.type-filter{position:relative}.type-filter [role=listbox]{position:absolute;z-index:1;background:var(--color-surface,#fff);padding:.3rem;box-shadow:0 3px 12px #0003}.type-filter [role=option]{display:block;width:100%;text-align:left}.file-input{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.results{padding:1rem 1.4rem;min-height:10rem;max-height:calc(94dvh - 24rem);overflow:auto;overscroll-behavior:contain}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(9rem,1fr));gap:.75rem}.list{display:grid;gap:.5rem}.upload-job{display:grid;gap:.5rem;padding:1rem;border:1px solid #ccd2dc;border-radius:.5rem}.upload-job[data-upload-status=failed]{border-color:#c73545}.folders{display:flex;flex-wrap:wrap;gap:.5rem;padding:0 1.4rem}.pagination{justify-content:center}.pagination input{width:2.5rem}.pagination label{display:flex;align-items:center;gap:.4rem}nav:not(.pagination){display:flex;gap:.5rem;align-items:center;padding:0 1.4rem}.selection{padding:0 1.4rem}.selection ul{padding:0;list-style:none;display:grid;gap:.4rem}.selection li{display:flex;align-items:center;gap:.5rem}.selection li>span:first-child{margin-right:auto}.url-input{padding:1.4rem;display:flex;gap:.5rem;flex-wrap:wrap;align-items:end}.url-input label{flex:1}.url-preview{margin:1rem;display:flex;gap:1rem;align-items:center}.url-preview img{width:8rem;height:6rem;object-fit:cover}footer[hidden]{display:none}footer{justify-content:end;border-top:1px solid #dde1e8}.announcement{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}@media(max-width:600px){dialog{width:96vw}header,.toolbar,.filters,.results,footer{padding:.8rem}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.selection li{flex-wrap:wrap}}
</style>
