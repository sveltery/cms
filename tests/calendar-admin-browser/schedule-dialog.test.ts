// Supplemental Native controls mount the actual product. No Source, URL,
// canonical storage, HTTP, authorization or session credit is claimed.
import { afterEach,describe,expect,it,vi } from 'vitest';
import { page } from 'vitest/browser';
import { flushSync,mount,unmount } from 'svelte';
import Dialog from '../../src/lib/calendar/CalendarScheduleDialog.svelte';
import { bridgeState } from '../helpers/calendar-admin/state.svelte.ts';
let component:ReturnType<typeof mount>|undefined,target:HTMLElement|undefined;
afterEach(async()=>{if(component)await unmount(component);component=undefined;target?.remove();target=undefined;});
function render(onSchedule:(at:string)=>void|Promise<void>=vi.fn()){
  target=document.createElement('div');document.body.append(target);
  const onOpenChange=vi.fn((open:boolean)=>{state.open=open;});
  const state=bridgeState({open:true,entryKey:'scheduled:posts:launch:en',scheduledAt:new Date(2030,9,20,9,0).toISOString(),locale:'en',onOpenChange,onSchedule});
  component=flushSync(()=>mount(Dialog,{target:target!,props:state as any}));
  return {state,onOpenChange,onSchedule,panel:page.getByRole('dialog',{name:'Change schedule'})};
}
describe('Native calendar schedule dialog',()=>{
  it('dismisses an abandoned schedule by clicking its actual backdrop',async()=>{
    const {panel,onOpenChange}=render();await expect.element(panel).toBeVisible();
    await panel.click({position:{x:-12,y:30},force:true});
    await expect.poll(()=>onOpenChange.mock.calls).toEqual([[false]]);
  });
  it('keeps an unchanged schedule disabled and resets an abandoned edit',async()=>{
    const {state,panel,onOpenChange}=render();
    await expect.element(panel.getByRole('textbox',{name:'Hour'})).toHaveValue('09');
    await expect.element(panel.getByRole('button',{name:'Save schedule'})).toBeDisabled();
    await panel.getByRole('textbox',{name:'Minute'}).fill('30');
    await expect.element(panel.getByRole('button',{name:'Save schedule'})).toBeEnabled();
    await panel.getByRole('button',{name:'Cancel'}).click();
    await expect.poll(()=>onOpenChange.mock.calls).toEqual([[false]]);
    flushSync(()=>{state.open=true;});
    await expect.element(panel.getByRole('textbox',{name:'Minute'})).toHaveValue('00');
    await expect.element(panel.getByRole('button',{name:'Save schedule'})).toBeDisabled();
  });
  it('submits one serialized future instant and closes after acceptance',async()=>{
    const onSchedule=vi.fn().mockResolvedValue(undefined);
    const {panel,onOpenChange}=render(onSchedule);
    await panel.getByRole('textbox',{name:'Minute'}).fill('45');
    await panel.getByRole('button',{name:'Save schedule'}).click();
    await expect.poll(()=>onSchedule.mock.calls).toEqual([[new Date(2030,9,20,9,45).toISOString()]]);
    await expect.poll(()=>onOpenChange.mock.calls).toEqual([[false]]);
  });
  it('keeps a new entry open when an earlier pending submission finishes',async()=>{
    let accept!:()=>void;
    const onSchedule=vi.fn(()=>new Promise<void>(resolve=>{accept=resolve;}));
    const {state,panel,onOpenChange}=render(onSchedule);
    await panel.getByRole('textbox',{name:'Minute'}).fill('30');
    await panel.getByRole('button',{name:'Save schedule'}).click();
    await expect.poll(()=>onSchedule.mock.calls.length).toBe(1);
    await expect.element(panel.getByRole('textbox',{name:'Minute'})).toBeDisabled();
    flushSync(()=>{state.entryKey='scheduled:posts:next:en';state.scheduledAt=new Date(2030,9,21,15,0).toISOString();});
    accept();
    await expect.element(panel.getByRole('textbox',{name:'Hour'})).toHaveValue('03');
    await expect.element(panel.getByRole('textbox',{name:'Minute'})).toBeEnabled();
    expect(onOpenChange).not.toHaveBeenCalled();
    await expect.element(panel).toBeVisible();
    await expect.element(panel.getByRole('button',{name:'Save schedule'})).toBeDisabled();
  });
});
