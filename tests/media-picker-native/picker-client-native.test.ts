import {afterEach,expect,it,vi} from 'vitest';
import {uploadMedia} from '../../src/lib/media/picker-client';

// Original native transport callbacks. EmDash1.1.0 media-upload.test.ts is the
// behavior reference; these are not the immutable Source callback bodies.
// Fetch spies establish request/response behavior, not actual server admission.
afterEach(()=>vi.restoreAllMocks());

it.each([
 {name:'empty',bytes:new Uint8Array(),hash:undefined},
 {name:'nonempty',bytes:new Uint8Array([97,98,99]),hash:'sha1:a9993e364706816aba3e25717850c26c9cd0d89d'}
])('retains signed upload metadata and correct $name-file deduplication',async({bytes,hash})=>{
 const controller=new AbortController();
 const file=new File([bytes],'document.pdf',{type:'application/pdf'});
 const item={id:'uploaded-media',filename:'document.pdf',mimeType:file.type,url:'/api/media/file/document.pdf',storageKey:'document.pdf',size:file.size,createdAt:'2026-10-03T00:00:00Z',caption:'Preserved caption',alt:'Preserved alt',meta:{native:true}};
 let uploadBody:Record<string,unknown>|undefined;
 const request=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  if(url==='/api/media/upload-url'){
   uploadBody=JSON.parse(String(init?.body));
   return Response.json({success:true,data:{mediaId:item.id,uploadUrl:'/api/media/uploaded-media/upload',method:'PUT',headers:{'content-type':file.type}}});
  }
  if(url==='/api/media/uploaded-media/upload')return new Response(null,{status:200});
  if(url==='/api/media/uploaded-media/confirm')return Response.json({success:true,data:{item}});
  throw new Error(`Unexpected native transport request: ${url}`);
 });

 const selected=await uploadMedia(file,{signal:controller.signal});

 if(hash===undefined)expect(uploadBody).not.toHaveProperty('contentHash');
 else expect(uploadBody?.contentHash).toBe(hash);
 expect(uploadBody).toMatchObject({filename:file.name,contentType:file.type,size:file.size});
 expect(selected).toEqual(item);
 expect(request).toHaveBeenCalledTimes(3);
 expect(request.mock.calls.every(([,init])=>init?.signal===controller.signal)).toBe(true);
});
