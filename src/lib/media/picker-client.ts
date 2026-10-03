import {base} from '$app/paths';
import {computeContentHash,MAX_CONTENT_HASH_BYTES} from './hash';
import {localMediaFileUrl} from './source/picker-media-utils';
import type {MediaItem,MediaFolder,MediaProviderItem,MediaProviderInfo} from './picker-item-types';
export type {MediaItem,MediaFolder,MediaProviderItem,MediaProviderInfo} from './picker-item-types';

export interface MediaListOptions {page?:number;limit?:number;search?:string;mimeType?:string[];folderId?:string|null}
export interface MediaPickerClient {
 fetchMediaList:(options?:MediaListOptions)=>Promise<{items:MediaItem[];totalCount?:number}>;
 fetchMediaFolders:(options?:{limit?:number;cursor?:string;search?:string})=>Promise<{items:MediaFolder[];nextCursor?:string}>;
 fetchMediaFolder?:(id:string)=>Promise<MediaFolder>;
 fetchMediaProviders?:()=>Promise<MediaProviderInfo[]>;
 fetchProviderMedia?:(id:string,options:{limit:number;query?:string;mimeType?:string[]})=>Promise<{items:MediaProviderItem[]}>;
 uploadMedia?:(file:File,options?:{fieldId?:string;signal?:AbortSignal})=>Promise<MediaItem>;
 uploadToProvider?:(id:string,file:File,alt?:string,options?:{signal?:AbortSignal})=>Promise<MediaProviderItem>;
 updateMedia?:(id:string,input:{width:number;height:number})=>Promise<MediaItem>;
}
export class MediaPickerApiError extends Error {
 constructor(message:string,readonly code:string,readonly status:number){super(message);}
}
const href=(url:string)=>url.startsWith('/')?`${base}${url}`:url;
async function api<T>(url:string,init:RequestInit={}):Promise<T>{
 const response=await fetch(href(url),init);
 const body=await response.json();
 if(!response.ok||!body.success)throw new MediaPickerApiError(body.error?.message??'Media request failed',body.error?.code??'REQUEST_FAILED',response.status);
 return body.data;
}
function mediaItem(item:MediaItem):MediaItem {
 return {...item,url:item.url||(item.storageKey?href(localMediaFileUrl(item.storageKey)):'')};
}
export async function fetchMediaList(options:MediaListOptions={}){
 const params=new URLSearchParams({page:String(options.page??1),limit:String(options.limit??12)});
 if(options.search?.trim())params.set('q',options.search.trim().slice(0,200));
 if(options.mimeType?.length)params.set('mimeType',options.mimeType.join(','));
 if(options.folderId!==undefined)params.set('folderId',options.folderId??'unfiled');
 const result=await api<{items:MediaItem[];totalCount?:number}>(`/api/media?${params}`);
 return {...result,items:result.items.map(mediaItem)};
}
export async function fetchMediaFolders(options:{limit?:number;cursor?:string;search?:string}={}){
 const params=new URLSearchParams({limit:String(options.limit??100)});
 if(options.cursor)params.set('cursor',options.cursor);
 if(options.search?.trim())params.set('q',options.search.trim().slice(0,200));
 return api<{items:MediaFolder[];nextCursor?:string}>(`/api/media/folders?${params}`);
}
export async function fetchMediaFolder(id:string){const result=await api<{item:MediaFolder}>(`/api/media/folders/${encodeURIComponent(id)}`);return result.item;}
export async function updateMedia(id:string,input:{width:number;height:number}){
 const result=await api<{item:MediaItem}>(`/api/media/${encodeURIComponent(id)}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
 return mediaItem(result.item);
}
export async function fetchPickerCurrentUser():Promise<{id:string;role:number}|undefined>{
 return api<{id:string;role:number}>('/api/auth/me');
}

// Image/video probes follow the complete pinned Source abort/cleanup behavior.
export async function getImageDimensions(file:File,options?:{signal?:AbortSignal}):Promise<{width:number;height:number}|null>{
 options?.signal?.throwIfAborted();
 if(!file.type.startsWith('image/'))return null;
 return new Promise((resolve,reject)=>{
  const img=new Image(),objectUrl=URL.createObjectURL(file);
  const cleanup=()=>{img.onload=null;img.onerror=null;options?.signal?.removeEventListener('abort',handleAbort);URL.revokeObjectURL(objectUrl);};
  const handleAbort=()=>{cleanup();reject(options?.signal?.reason);};
  img.onload=()=>{const dimensions={width:img.naturalWidth,height:img.naturalHeight};cleanup();resolve(dimensions);};
  img.onerror=()=>{cleanup();resolve(null);};
  options?.signal?.addEventListener('abort',handleAbort,{once:true});
  if(options?.signal?.aborted){handleAbort();return;}
  img.src=objectUrl;
 });
}
export async function getVideoDimensions(file:File,options?:{signal?:AbortSignal}):Promise<{width:number;height:number}|null>{
 options?.signal?.throwIfAborted();if(!file.type.startsWith('video/'))return null;
 return new Promise((resolve,reject)=>{
  const video=document.createElement('video'),objectUrl=URL.createObjectURL(file);
  const cleanup=()=>{video.removeEventListener('loadedmetadata',handleLoaded);video.removeEventListener('error',handleError);options?.signal?.removeEventListener('abort',handleAbort);video.src='';video.load();URL.revokeObjectURL(objectUrl);};
  const handleLoaded=()=>{const width=video.videoWidth,height=video.videoHeight;cleanup();resolve(width&&height?{width,height}:null);};
  const handleError=()=>{cleanup();resolve(null);};
  const handleAbort=()=>{cleanup();reject(options?.signal?.reason);};
  video.addEventListener('loadedmetadata',handleLoaded,{once:true});video.addEventListener('error',handleError,{once:true});options?.signal?.addEventListener('abort',handleAbort,{once:true});
  if(options?.signal?.aborted){handleAbort();return;}
  video.muted=true;video.playsInline=true;video.preload='metadata';video.src=objectUrl;video.load();
 });
}
export async function uploadMedia(file:File,options?:{fieldId?:string;signal?:AbortSignal}):Promise<MediaItem>{
 const signal=options?.signal;signal?.throwIfAborted();
 let contentHash:string|undefined;
 if(file.size>0&&file.size<=MAX_CONTENT_HASH_BYTES){
  try{contentHash=await computeContentHash(await file.arrayBuffer());}catch{signal?.throwIfAborted();}
 }
 signal?.throwIfAborted();
 const pending=await api<{mediaId:string;uploadUrl:string;method:'PUT';headers:Record<string,string>;existing?:boolean}>('/api/media/upload-url',{method:'POST',headers:{'content-type':'application/json'},signal,body:JSON.stringify({filename:file.name,contentType:file.type,size:file.size,...(contentHash?{contentHash}:{}),...(options?.fieldId?{fieldId:options.fieldId}:{})})});
 if(pending.existing){const result=await api<{item:MediaItem}>(`/api/media/${encodeURIComponent(pending.mediaId)}`,{signal});return mediaItem(result.item);}
 const headers={...pending.headers};
 if(file.type)headers['Content-Type']=file.type;
 const response=await fetch(href(pending.uploadUrl),{method:pending.method,headers,body:file,signal});
 if(!response.ok)throw new Error('File upload failed');
 const dimensions=file.type.startsWith('image/')?await getImageDimensions(file,options):await getVideoDimensions(file,options);
 const result=await api<{item:MediaItem}>(`/api/media/${encodeURIComponent(pending.mediaId)}/confirm`,{method:'POST',headers:{'content-type':'application/json'},signal,body:JSON.stringify({size:file.size,width:dimensions?.width,height:dimensions?.height})});
 return mediaItem(result.item);
}

// External provider discovery/browse/upload functions are deliberately absent
// until the provider owner publishes their actual API implementation.
export const nativeMediaPickerClient:MediaPickerClient={fetchMediaList,fetchMediaFolders,fetchMediaFolder,uploadMedia,updateMedia};
