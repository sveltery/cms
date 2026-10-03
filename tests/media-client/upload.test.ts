import {afterEach,expect,it,vi} from 'vitest';
import {uploadMediaFile} from '../../src/lib/media/client';
import type {MediaItem} from '../../src/lib/media/types';

const item:MediaItem={id:'ready-media',filename:'empty.png',mimeType:'image/png',url:'/_emdash/api/media/file/ready.png',storageKey:'ready.png',size:0,width:null,height:null,alt:null,caption:null,focalX:null,focalY:null,blurhash:null,dominantColor:null,folderId:null,status:'ready',authorId:null,createdAt:'2026-01-01T00:00:00Z'};
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
function uploadTransport(){
 let requestBody:Record<string,unknown>|undefined;
 const fetch=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  if(input==='/api/media/upload-url'){requestBody=JSON.parse(String(init?.body));return Response.json({success:true,data:{uploadUrl:'/api/media/ready-media/upload',method:'PUT',headers:{},mediaId:item.id}});}
  if(input==='/api/media/ready-media/upload'){expect(init?.body).toBeInstanceOf(File);return Response.json({success:true,data:{uploaded:true}});}
  if(input==='/api/media/ready-media/confirm')return Response.json({success:true,data:{item}});
  throw new Error(`Unexpected transport: ${String(input)}`);
 });
 return {fetch,body:()=>requestBody};
}
it('omits shared content hash for an empty file while completing the native upload transport',async()=>{
 const transport=uploadTransport();const result=await uploadMediaFile(new File([],'empty.png',{type:'image/png'}));
 expect(transport.body()).not.toHaveProperty('contentHash');expect(result).toEqual(item);expect(transport.fetch).toHaveBeenCalledTimes(3);
});
it('keeps distinct cropped copy flags and original folder through the native upload transport',async()=>{
 const transport=uploadTransport();const result=await uploadMediaFile(new File(['png'],'crop.png',{type:'image/png'}),{deduplicate:false,ensureUniqueFilename:true,folderId:'original-folder'});
 expect(transport.body()).toMatchObject({deduplicate:false,ensureUniqueFilename:true,folderId:'original-folder'});expect(transport.body()).not.toHaveProperty('contentHash');expect(result).toEqual(item);
});
it('continues without deduplication when content hashing fails',async()=>{
 vi.stubGlobal('crypto',{subtle:{digest:vi.fn().mockRejectedValue(new Error('SHA-1 unavailable'))}});
 const transport=uploadTransport();const result=await uploadMediaFile(new File(['image'],'photo.png',{type:'image/png'}));
 expect(transport.body()).not.toHaveProperty('contentHash');expect(result).toEqual(item);
});
it('does not dispatch an upload after cancellation',async()=>{
 const transport=uploadTransport();const controller=new AbortController();controller.abort();
 await expect(uploadMediaFile(new File(['image'],'photo.png'),{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});expect(transport.fetch).not.toHaveBeenCalled();
});
