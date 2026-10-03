import {afterEach,expect,it,vi} from 'vitest';
import {flushSync,mount,tick,unmount} from 'svelte';
import Picker from '../../src/lib/media/MediaPickerModal.svelte';

// Original native component tests. Explicit user props and fetch spies qualify
// display/callback behavior only, with no real identity or storage admission.
const mounts:ReturnType<typeof mount>[]=[];
const item={id:'native-asset',filename:'asset.png',mimeType:'image/png',url:'/asset.png',storageKey:'asset.png',size:10,width:100,height:80,alt:'Original alt',caption:'Original caption',focalX:0.2,focalY:0.8,blurhash:'retained-blurhash',dominantColor:'#223344',folderId:null,status:'ready' as const,authorId:'native-editor',createdAt:'2026-10-03T00:00:00Z'};
afterEach(async()=>{vi.restoreAllMocks();for(const instance of mounts.splice(0))await unmount(instance);document.body.replaceChildren();});
async function select(){
 const target=document.createElement('div');document.body.append(target);
 const onSelect=vi.fn();
 const client={fetchMediaList:vi.fn().mockResolvedValue({items:[item],totalCount:1}),fetchMediaFolders:vi.fn().mockResolvedValue({items:[]})};
 mounts.push(mount(Picker,{target,props:{open:true,onSelect,onOpenChange:vi.fn(),currentUser:{id:item.authorId,role:40},client}}));
 await tick();await tick();flushSync();
 const button=document.querySelector<HTMLButtonElement>(`button[aria-label="${item.filename}"]`);
 expect(button).toBeInstanceOf(HTMLButtonElement);button!.click();await tick();flushSync();
 return {onSelect};
}
function button(text:string){return Array.from(document.querySelectorAll('button')).find(value=>value.textContent?.trim()===text);}
it('offers actual default asset details for an editable local image without a snippet',async()=>{
 await select();
 expect(button('Edit selected asset')).toBeInstanceOf(HTMLButtonElement);
 button('Edit selected asset')!.click();await tick();
 expect(document.querySelectorAll('dialog')).toHaveLength(1);
 expect(document.querySelector('[aria-label="Media details"]')).not.toBeNull();
 expect(button('Delete media')).toBeUndefined();
 button('Back')!.click();await tick();
 expect(document.querySelector('[aria-label="Media details"]')).toBeNull();
 expect(document.activeElement).toBe(button('Edit selected asset'));
});
it('keeps the complete refreshed asset metadata when confirming from the default workspace',async()=>{
 const {onSelect}=await select();
 expect(button('Edit selected asset')).toBeInstanceOf(HTMLButtonElement);
 const refreshed={...item,alt:'Updated alt',caption:'Updated caption',focalX:0.3,focalY:0.6};
 const request=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  expect(input).toBe('/api/media/native-asset');expect(init?.method).toBe('PUT');
  expect(JSON.parse(String(init?.body))).toMatchObject({alt:refreshed.alt,caption:refreshed.caption,focalX:refreshed.focalX,focalY:refreshed.focalY});
  return Response.json({success:true,data:{item:refreshed}});
 });
 button('Edit selected asset')!.click();await tick();
 const inputs=Array.from(document.querySelectorAll('input'));
 const alt=inputs.find(input=>input.closest('label')?.textContent?.includes('Alt text'))!;
 alt.value=refreshed.alt;alt.dispatchEvent(new Event('input',{bubbles:true}));
 const caption=document.querySelector('textarea')!;caption.value=refreshed.caption;caption.dispatchEvent(new Event('input',{bubbles:true}));
 for(const [label,value] of [['Horizontal focal point',refreshed.focalX],['Vertical focal point',refreshed.focalY]] as const){const input=inputs.find(input=>input.closest('label')?.textContent?.includes(label))!;input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));}
 await tick();button('Save changes')!.click();
 await vi.waitFor(()=>expect(request).toHaveBeenCalledOnce());
 await vi.waitFor(()=>expect(document.body.textContent).toContain('Media details saved'));
 button('Back')!.click();await tick();button('Select')!.click();
 expect(onSelect).toHaveBeenCalledWith(refreshed);
});
