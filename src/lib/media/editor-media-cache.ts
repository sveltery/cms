// Native query lifecycle for the complete pinned ImageNode/GalleryPreviewImage media algorithms.
// EmDash1.1.0 913cb1bb; Copyright2026 Cloudflare Inc. MIT notices/emdash-MIT.txt.
// One caller-supplied QueryClient; no document attribute, identity or storage writer.
import {QueryObserver,type QueryClient} from '@tanstack/react-query';
import {fetchMediaItem,type LocalMediaItem} from './source/api/media.ts';
import {canonicalMediaProviderId,getMediaPreviewUrl,localMediaFileUrl} from './source/media-utils.ts';

export interface ImagePreviewAttributes {mediaId?:unknown;provider?:string;src?:unknown}
export interface GalleryPreviewImage {asset:{_ref:string;url?:string;provider?:string}}

export function observeImageMediaPreview(queryClient:QueryClient,initial:ImagePreviewAttributes) {
  let attributes=initial;
  const options=()=>{
    const mediaId=typeof attributes.mediaId==='string'&&attributes.mediaId&&canonicalMediaProviderId(attributes.provider)==='local'?attributes.mediaId:null;
    return {queryKey:['media',mediaId],queryFn:({signal}:{signal:AbortSignal})=>fetchMediaItem(mediaId!,{signal}),enabled:mediaId!==null};
  };
  const observer=new QueryObserver<LocalMediaItem>(queryClient,options());
  const listeners=new Set<()=>void>();let stop:(()=>void)|undefined;
  return {
    queryClient,
    start(){if(!stop)stop=observer.subscribe(()=>{for(const listener of listeners)listener();});},
    update(next:ImagePreviewAttributes){attributes=next;observer.setOptions(options());},
    subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
    snapshot(){const result=observer.getCurrentResult(),storedSrc=typeof attributes.src==='string'?attributes.src:'';return {src:getMediaPreviewUrl(result.data?.url||storedSrc,result.data?.contentHash),currentMedia:result.data,error:result.error,isFetching:result.isFetching};},
    dispose(){stop?.();observer.destroy();listeners.clear();},
  };
}

export function observeGalleryMediaPreview(queryClient:QueryClient,initial:GalleryPreviewImage) {
  let image=initial;
  const options=()=>{
    const mediaId=canonicalMediaProviderId(image.asset.provider)==='local'&&image.asset._ref?image.asset._ref:null;
    return {queryKey:mediaId?['media',mediaId]:['media-preview-disabled',image.asset._ref],queryFn:({signal}:{signal:AbortSignal})=>fetchMediaItem(mediaId!,{signal}),enabled:false};
  };
  const observer=new QueryObserver<LocalMediaItem>(queryClient,options());
  const listeners=new Set<()=>void>();let stop:(()=>void)|undefined;
  return {
    queryClient,
    start(){if(!stop)stop=observer.subscribe(()=>{for(const listener of listeners)listener();});},
    update(next:GalleryPreviewImage){image=next;observer.setOptions(options());},
    subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
    snapshot(){const result=observer.getCurrentResult(),storedSrc=image.asset.url||(image.asset._ref?localMediaFileUrl(image.asset._ref):'');return {src:getMediaPreviewUrl(storedSrc,result.data?.contentHash),currentMedia:result.data,error:result.error,isFetching:result.isFetching};},
    dispose(){stop?.();observer.destroy();listeners.clear();},
  };
}
