// Original actual workerd host for complete pinned endpoint bodies and actual R2/Images.
import type {R2Bucket,ImagesBinding} from '@cloudflare/workers-types';
import {R2Storage} from '../../src/lib/server/media/r2.ts';
import {createWorkerImageEndpoint} from '../../src/lib/server/media/image/worker-endpoint.ts';
export default {fetch(request:Request,env:{BUCKET:R2Bucket;IMAGES?:ImagesBinding}){
 return createWorkerImageEndpoint({env:env as unknown as Record<string,unknown>,adapterGET:async()=>new Response('Not Found',{status:404})})({request,locals:{emdash:{storage:new R2Storage(env.BUCKET)}}});
}};
