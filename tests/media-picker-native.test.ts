import {afterEach, expect, it, vi} from 'vitest';
import {flushSync, mount, tick, unmount} from 'svelte';
import MediaPicker from '../src/lib/media/MediaPickerModal.svelte';

const instances: ReturnType<typeof mount>[] = [];
afterEach(async () => {
 for (const instance of instances.splice(0)) await unmount(instance);
 document.body.replaceChildren();
});
async function picker(onSelect = vi.fn()) {
 const target = document.createElement('div');
 document.body.append(target);
 const item = {id:'native-photo',filename:'native-photo.jpg',mimeType:'image/jpeg',url:'/native-photo.jpg',size:4,createdAt:'2026-10-03T00:00:00Z'};
 const client = {fetchMediaList:vi.fn().mockResolvedValue({items:[item],totalCount:1}),fetchMediaFolders:vi.fn().mockResolvedValue({items:[]}),fetchMediaProviders:vi.fn().mockResolvedValue([])};
 instances.push(mount(MediaPicker,{target,props:{open:true,onSelect,onOpenChange:vi.fn(),client}}));
 await tick();
 await tick();
 flushSync();
 return {item,onSelect,client};
}
it('requires confirmation before returning the chosen library item',async()=>{
 const {item,onSelect}=await picker();
 const buttons=Array.from(document.querySelectorAll('button'));
 expect(buttons.map(button=>button.getAttribute('aria-label')??button.textContent?.trim())).toContain(item.filename);
 const card=buttons.find(button=>button.getAttribute('aria-label')===item.filename||button.textContent?.trim()===item.filename)!;
 card.click();
 await tick();
 expect(onSelect).not.toHaveBeenCalled();
 const confirm=Array.from(document.querySelectorAll('button')).find(button=>button.textContent?.trim()==='Select')!;
 expect(confirm.disabled).toBe(false);
 confirm.click();
 expect(onSelect).toHaveBeenCalledWith(item);
});
it('offers an inline file chooser that obeys the image MIME filter',async()=>{
 await picker();
 const input=document.querySelector('input[type="file"]');
 expect(input).toBeInstanceOf(HTMLInputElement);
 expect((input as HTMLInputElement).accept).toBe('image/');
});
