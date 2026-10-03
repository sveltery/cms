import type {RequestEvent} from '@sveltejs/kit';
import {requestMediaStorage} from '../storage.ts';
import {createNodeImageEndpoint} from './node-endpoint.ts';
import {createWorkerImageEndpoint} from './worker-endpoint.ts';

/** Native route transport; complete pinned endpoint bodies receive actual storage and codec bindings. */
export async function mediaImageHttp(event:RequestEvent):Promise<Response>{
 const storage=await requestMediaStorage(event);
 const context={request:event.request,locals:{emdash:{storage}}};
 const unsupportedImage=async()=>new Response('Not Found',{status:404});
 if(event.platform?.env){
  return createWorkerImageEndpoint({env:event.platform.env,adapterGET:unsupportedImage})(context);
 }
 const {getNativeImageService}=await import('./node-service.ts');
 return createNodeImageEndpoint({genericGET:unsupportedImage,getConfiguredImageService:getNativeImageService,imageConfig:{}})(context);
}
