// Original native UI checks; complete Source browser module is preserved separately.
// JSDOM and supplied API responses do not qualify a real browser or HTTP storage.
import {afterEach,expect,it,vi} from 'vitest';
import {mount,tick,unmount} from 'svelte';
import RedirectsPanel from '../../src/lib/ui/RedirectsPanel.svelte';
import type {Redirect} from '../../src/lib/redirects/client.ts';
const components:ReturnType<typeof mount>[]=[];
afterEach(async()=>{for(const component of components.splice(0))await unmount(component);document.body.replaceChildren();});
const row=(id:number):Redirect=>({id:String(id),source:`/source-${id}`,destination:`/destination-${id}`,type:301,
 isPattern:false,enabled:true,hits:0,lastHitAt:null,groupName:null,auto:false,createdAt:'2026-08-10T00:00:00.000Z',updatedAt:'2026-08-10T00:00:00.000Z'});
async function render(){
 const api={fetchRedirects:vi.fn(async({cursor}:{cursor?:string}={})=>cursor?{items:[row(101)]}:{items:Array.from({length:100},(_,i)=>row(i+1)),nextCursor:'page-2'}),
  fetch404Summary:vi.fn(async()=>[]),createRedirect:vi.fn(async()=>row(1)),updateRedirect:vi.fn(async()=>row(1)),deleteRedirect:vi.fn(async()=>{})};
 const target=document.createElement('section');document.body.append(target);
 components.push(mount(RedirectsPanel,{target,props:{api}}));await tick();await vi.waitFor(()=>expect(target.textContent).toContain('/source-100'));
 return{target,api};
}
it('native redirect list loads the second page and resets pagination after toggle',async()=>{
 const {target,api}=await render();
 (Array.from(target.querySelectorAll('button')).find(button=>button.textContent==='Load more') as HTMLButtonElement).click();
 await vi.waitFor(()=>expect(target.textContent).toContain('/source-101'));
 (target.querySelector('[role="switch"]') as HTMLButtonElement).click();
 await vi.waitFor(()=>expect(target.textContent).not.toContain('/source-101'));
 expect(api.fetchRedirects).toHaveBeenCalledWith(expect.objectContaining({cursor:'page-2',limit:100}));
 expect(api.updateRedirect).toHaveBeenCalledWith('1',{enabled:false});
 expect(Array.from(target.querySelectorAll('button')).some(button=>button.textContent==='Load more')).toBe(true);
});
it('native accessible tabs remove the redirect search and load the real client summary',async()=>{
 const {target,api}=await render(),tabs=target.querySelectorAll<HTMLButtonElement>('[role="tab"]');
 expect(tabs[0].getAttribute('aria-selected')).toBe('true');
 const path=tabs[0].querySelector('svg path')?.getAttribute('d');tabs[1].click();await tick();
 await vi.waitFor(()=>expect(target.textContent).toContain('No 404 errors recorded yet.'));
 expect(tabs[1].getAttribute('aria-selected')).toBe('true');expect(target.querySelector('[type="search"]')).toBeNull();
 expect(tabs[0].querySelector('svg path')?.getAttribute('d')).not.toBe(path);expect(api.fetch404Summary).toHaveBeenCalledWith(50);
});
it('native create dialog hides destination for terminal status and persists Source form values',async()=>{
 const {target,api}=await render();
 (Array.from(target.querySelectorAll('button')).find(button=>button.textContent==='New Redirect') as HTMLButtonElement).click();await tick();
 const source=target.querySelector<HTMLInputElement>('[name="source"]')!;source.value=' /removed ';source.dispatchEvent(new Event('input',{bubbles:true}));
 const type=target.querySelector<HTMLSelectElement>('[name="type"]')!;type.value='410';type.dispatchEvent(new Event('change',{bubbles:true}));await tick();
 expect(target.querySelector('[name="destination"]')).toBeNull();
 target.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 await vi.waitFor(()=>expect(api.createRedirect).toHaveBeenCalledWith({source:'/removed',destination:'',type:410,enabled:true,groupName:null}));
});
