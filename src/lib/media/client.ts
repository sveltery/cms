import {base} from '$app/paths';
import {computeContentHash,MAX_CONTENT_HASH_BYTES} from './hash';
import type {MediaItem} from './types';

export class MediaRequestError extends Error {
 readonly code:string;
 readonly status:number;
 constructor(code:string,message:string,status:number){super(message);this.name='MediaRequestError';this.code=code;this.status=status;}
}
export const mediaHref=(url:string)=>url.startsWith('/')?`${base}${url}`:url;
export async function mediaRequest<T>(path:string,options:RequestInit={}):Promise<T>{
 const response=await fetch(mediaHref(path),options);
 const result=await response.json();
 if(!response.ok||!result.success)throw new MediaRequestError(result.error?.code??'MEDIA_REQUEST_FAILED',result.error?.message??'Media request failed',response.status);
 return result.data;
}
export interface UploadMediaFileOptions {deduplicate?:boolean;ensureUniqueFilename?:boolean;folderId?:string|null;signal?:AbortSignal}
/** Shared native upload operation: the server remains authoritative for admission and metadata. */
export async function uploadMediaFile(file:File,options:UploadMediaFileOptions={}):Promise<MediaItem>{
 options.signal?.throwIfAborted();
 const contentHash=options.deduplicate!==false&&file.size<=MAX_CONTENT_HASH_BYTES?await computeContentHash(await file.arrayBuffer()):undefined;
 options.signal?.throwIfAborted();
 const pending=await mediaRequest<{uploadUrl:string;method:'PUT';headers:Record<string,string>;mediaId:string;existing?:boolean}>('/api/media/upload-url',{method:'POST',headers:{'content-type':'application/json'},signal:options.signal,body:JSON.stringify({filename:file.name,contentType:file.type||'application/octet-stream',size:file.size,contentHash,...(options.deduplicate===false?{deduplicate:false}:{}),...(options.ensureUniqueFilename?{ensureUniqueFilename:true}:{}),...(options.folderId!==undefined?{folderId:options.folderId}:{})})});
 if(pending.existing)return (await mediaRequest<{item:MediaItem}>(`/api/media/${pending.mediaId}`,{signal:options.signal})).item;
 const response=await fetch(mediaHref(pending.uploadUrl),{method:pending.method,headers:pending.headers,body:file,signal:options.signal});
 if(!response.ok){let failure;try{failure=await response.json();}catch{/* External storage may return a non-JSON error. */}throw new MediaRequestError(failure?.error?.code??'UPLOAD_FAILED',failure?.error?.message??'File upload failed',response.status);}
 return (await mediaRequest<{item:MediaItem}>(`/api/media/${pending.mediaId}/confirm`,{method:'POST',headers:{'content-type':'application/json'},signal:options.signal,body:'{}'})).item;
}
