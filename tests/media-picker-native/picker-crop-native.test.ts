import {afterEach,expect,it,vi} from 'vitest';
import {flushSync,mount,tick,unmount} from 'svelte';
import Picker from '../../src/lib/media/MediaPickerModal.svelte';

// Original browser acceptance of the actual default workspace and Canvas.
// Fetch spies and an explicit user qualify callbacks/encoding, not real server
// admission, authentication, content-field persistence or Source Panel parity.
const mounts:ReturnType<typeof mount>[]=[];
afterEach(async()=>{vi.restoreAllMocks();for(const instance of mounts.splice(0))await unmount(instance);document.body.replaceChildren();});
const button=(text:string)=>Array.from(document.querySelectorAll('button')).find(value=>value.textContent?.trim()===text);
async function input(label:string,value:number){
 const field=Array.from(document.querySelectorAll('input')).find(value=>value.closest('label')?.textContent?.trim()===label)!;
 expect(field).toBeInstanceOf(HTMLInputElement);field.value=String(value);field.dispatchEvent(new Event('input',{bubbles:true}));await tick();
}
it('encodes a real cropped PNG and confirms the complete new-copy selection from default details',async()=>{
 const canvas=document.createElement('canvas');canvas.width=80;canvas.height=40;
 const context=canvas.getContext('2d')!;context.fillStyle='#ff0000';context.fillRect(0,0,80,40);
 const url=canvas.toDataURL('image/png');
 const original={id:'original-image',filename:'source.png',mimeType:'image/png',url,storageKey:'original.png',size:80,width:80,height:40,alt:'Original alt',caption:'Original caption',focalX:0.2,focalY:0.8,blurhash:'retained-original',dominantColor:'#ff0000',folderId:'source-folder',status:'ready' as const,authorId:'native-editor',createdAt:'2026-10-03T00:00:00Z'};
 const copy={...original,id:'cropped-image',filename:'source-cropped.png',storageKey:'cropped.png',width:20,height:10,alt:null,caption:null,focalX:null,focalY:null,blurhash:'copy-blurhash'};
 const onSelect=vi.fn(),target=document.createElement('div');document.body.append(target);
 const client={fetchMediaList:vi.fn().mockResolvedValue({items:[original],totalCount:1}),fetchMediaFolders:vi.fn().mockResolvedValue({items:[]})};
 let encoded:File|undefined;
 const requests=vi.spyOn(globalThis,'fetch').mockImplementation(async(path,options)=>{
  if(path==='/api/media/upload-url'){
   expect(options?.method).toBe('POST');expect(JSON.parse(String(options?.body))).toMatchObject({contentType:'image/png',deduplicate:false,ensureUniqueFilename:true,folderId:original.folderId});
   return Response.json({success:true,data:{mediaId:copy.id,uploadUrl:'/native-crop-upload',method:'PUT',headers:{'Content-Type':'image/png'}}});
  }
  if(path==='/native-crop-upload'){
   expect(options?.method).toBe('PUT');expect(options?.body).toBeInstanceOf(File);encoded=options!.body as File;
   return new Response(null,{status:200});
  }
  expect(path).toBe(`/api/media/${copy.id}/confirm`);expect(options?.method).toBe('POST');
  return Response.json({success:true,data:{item:copy}});
 });
 mounts.push(mount(Picker,{target,props:{open:true,onSelect,onOpenChange:vi.fn(),currentUser:{id:original.authorId,role:40},client}}));
 await tick();await tick();flushSync();
 const choose=document.querySelector<HTMLButtonElement>(`button[aria-label="${original.filename}"]`);expect(choose).toBeInstanceOf(HTMLButtonElement);choose!.click();await tick();
 button('Edit asset')!.click();await tick();button('Crop image')!.click();await tick();
 await vi.waitFor(()=>expect(button('Create cropped copy')?.disabled).toBe(false));
 const aspect=document.querySelector('select')!;aspect.value='freeform';aspect.dispatchEvent(new Event('change',{bubbles:true}));await tick();
 await input('Crop X',10);await input('Crop Y',5);await input('Crop width',20);await input('Crop height',10);
 expect(document.querySelector('[aria-label="Crop output dimensions"]')?.textContent).toBe('20 × 10');
 button('Create cropped copy')!.click();
 await vi.waitFor(()=>expect(requests).toHaveBeenCalledTimes(3));
 await vi.waitFor(()=>expect(document.querySelectorAll('dialog')).toHaveLength(1));
 expect(encoded?.type).toBe('image/png');expect(encoded!.size).toBeGreaterThan(0);
 const bitmap=await createImageBitmap(encoded!);expect(bitmap.width).toBe(20);expect(bitmap.height).toBe(10);
 const pixels=document.createElement('canvas');pixels.width=20;pixels.height=10;const pixelContext=pixels.getContext('2d')!;pixelContext.drawImage(bitmap,0,0);bitmap.close();
 expect(Array.from(pixelContext.getImageData(0,0,1,1).data)).toEqual([255,0,0,255]);
 expect(onSelect).not.toHaveBeenCalled();button('Back')!.click();await tick();button('Select')!.click();
 expect(onSelect).toHaveBeenCalledOnce();expect(onSelect).toHaveBeenCalledWith(copy);
});
