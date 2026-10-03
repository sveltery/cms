// Original ordinary DOM requirement; zero whole Source or browser credit.
import {expect,it,vi} from 'vitest';
import {mount,tick,unmount} from 'svelte';
import RedirectsPanel from '../../src/lib/ui/RedirectsPanel.svelte';
import type {Redirect,RedirectListResult} from '../../src/lib/redirects/client.ts';
it('filter change removes previous-filter rows while the next response is pending',async()=>{
 let resolveFiltered!:(value:RedirectListResult)=>void;
 const pending=new Promise<RedirectListResult>(resolve=>{resolveFiltered=resolve;});
 const row:Redirect={id:'disabled-old',source:'/disabled-old',destination:'/old-target',type:301,isPattern:false,
  enabled:false,hits:0,lastHitAt:null,groupName:null,auto:false,createdAt:'2026-08-10T00:00:00.000Z',updatedAt:'2026-08-10T00:00:00.000Z'};
 const api={fetchRedirects:vi.fn(async(options:{enabled?:boolean}={})=>options.enabled===true?pending:{items:[row]}),
  fetch404Summary:vi.fn(async()=>[]),createRedirect:vi.fn(),updateRedirect:vi.fn(),deleteRedirect:vi.fn()};
 const target=document.createElement('section');document.body.append(target);
 const component=mount(RedirectsPanel,{target,props:{api}});
 try {
  await tick();await vi.waitFor(()=>expect(target.textContent).toContain('/disabled-old'));
  const filter=target.querySelector<HTMLSelectElement>('[aria-label="Filter by status"]')!;
  filter.value='true';filter.dispatchEvent(new Event('change',{bubbles:true}));await tick();
  await vi.waitFor(()=>expect(api.fetchRedirects).toHaveBeenCalledWith(expect.objectContaining({enabled:true})));
  expect(target.textContent).not.toContain('/disabled-old');
  expect(target.textContent).toContain('Loading redirects...');
 }finally {resolveFiltered({items:[]});await tick();await unmount(component);target.remove();}
});
