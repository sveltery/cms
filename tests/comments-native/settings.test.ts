// Whole Original native supplied-value control contracts; zero Source browser credit.
import { afterEach,expect,it,vi } from 'vitest';
import { mount,flushSync,tick,unmount } from 'svelte';
import NavigationHost from '../helpers/comments/SettingsNavigationHost.svelte';
import { settingsNavigationState } from '../helpers/comments/settings-state.svelte.ts';
import Settings from '../../src/lib/comments/CommentSettings.svelte';
import type { CommentSettingsCollection } from '../../src/lib/comments/settings-types.ts';
const mounted:Array<ReturnType<typeof mount>>=[];
afterEach(async()=>{for(const instance of mounted.splice(0))await unmount(instance);document.body.replaceChildren();vi.unstubAllGlobals();});
function fixture(patch:Partial<CommentSettingsCollection>={},onSave=vi.fn()){
 const collection:CommentSettingsCollection={slug:'posts',label:'Posts',source:'manual',version:1,updatedAt:'2026-01-01T00:00:00.000Z',commentsEnabled:true,commentsModeration:'first_time',commentsClosedAfterDays:90,commentsAutoApproveUsers:false,...patch};
 const target=document.createElement('div');document.body.append(target);mounted.push(flushSync(()=>mount(Settings,{target,props:{collection,onSave}})));return {target,collection,onSave};
}
it('preserves the actual stored false auto-approval and sends all four values with its revision',async()=>{
 const {target,collection,onSave}=fixture();const checks=target.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');expect(checks).toHaveLength(2);expect(checks[1].checked).toBe(false);
 const select=target.querySelector('select');expect(select?.value).toBe('first_time');select!.value='none';select!.dispatchEvent(new Event('change',{bubbles:true}));await tick();onSave.mockResolvedValue({...collection,commentsModeration:'none',updatedAt:'2026-01-01T00:00:00.001Z'});target.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await vi.waitFor(()=>expect(onSave).toHaveBeenCalledWith({commentsEnabled:true,commentsModeration:'none',commentsClosedAfterDays:90,commentsAutoApproveUsers:false},{version:1,updatedAt:collection.updatedAt}));await vi.waitFor(()=>expect(target.querySelector('button')?.textContent).toBe('Saved'));
});
it('hides conditional controls when disabled while retaining the four stored settings in save',async()=>{
 const {target,collection,onSave}=fixture();onSave.mockResolvedValue({...collection,commentsEnabled:false});target.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();await tick();expect(target.querySelector('select')).toBeNull();target.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await vi.waitFor(()=>expect(onSave).toHaveBeenCalledWith({commentsEnabled:false,commentsModeration:'first_time',commentsClosedAfterDays:90,commentsAutoApproveUsers:false},{version:1,updatedAt:collection.updatedAt}));
});
it('keeps changed controls and the existing revision when the supplied save fails',async()=>{
 const {target,collection,onSave}=fixture();onSave.mockRejectedValue(new Error('Collection has changed. Reload before saving.'));const days=target.querySelector<HTMLInputElement>('input[type="number"]');expect(days).not.toBeNull();days!.value='0';days!.dispatchEvent(new Event('input',{bubbles:true}));await tick();target.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await vi.waitFor(()=>expect(target.querySelector('[role="alert"]')?.textContent).toBe('Collection has changed. Reload before saving.'));expect(days!.value).toBe('0');expect(onSave.mock.calls[0][1]).toEqual({version:1,updatedAt:collection.updatedAt});expect(target.querySelector('button')?.disabled).toBe(false);
});
it('keeps every code-defined collection control read-only',async()=>{
 const {target,onSave}=fixture({source:'code'});expect(target.textContent).toContain('This collection is defined in code.');expect(target.querySelector('fieldset')?.disabled).toBe(true);expect(target.querySelector('button')).toBeNull();target.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await tick();expect(onSave).not.toHaveBeenCalled();
});
it('resets the actual page controls and CAS revision on collection navigation before saving to the new endpoint',async()=>{
 const {collection}=fixture();const state=settingsNavigationState(collection);const target=document.createElement('div');document.body.append(target);mounted.push(flushSync(()=>mount(NavigationHost,{target,props:{state}})));
 const next={...collection,slug:'pages',label:'Pages',version:4,updatedAt:'2026-02-02T00:00:00.000Z',commentsEnabled:false,commentsModeration:'none' as const,commentsClosedAfterDays:0,commentsAutoApproveUsers:true};
 state.data={...state.data,collection:next};await tick();expect(target.querySelector('h1')?.textContent).toContain('Pages');expect(target.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false);expect(target.querySelector('select')).toBeNull();
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({success:true,data:{...next,commentsEnabled:true,updatedAt:'2026-02-02T00:00:00.001Z'}}),{headers:{'content-type':'application/json'}}));vi.stubGlobal('fetch',fetcher);
 target.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();await tick();expect(target.querySelector('select')?.value).toBe('none');expect(target.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe('0');expect(target.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1].checked).toBe(true);
 target.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));expect(fetcher.mock.calls[0][0]).toBe('/cms/api/admin/comments/settings/pages');expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({input:{commentsEnabled:true,commentsModeration:'none',commentsClosedAfterDays:0,commentsAutoApproveUsers:true},expected:{version:4,updatedAt:next.updatedAt}});await vi.waitFor(()=>expect(target.querySelector('button')?.textContent).toBe('Saved'));
});
