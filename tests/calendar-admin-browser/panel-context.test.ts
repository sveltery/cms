// Supplemental Native UI controls. Original Source callbacks remain unchanged;
// these controlled client fixtures establish no HTTP/storage/authorization credit.
import { afterEach,describe,expect,it,vi } from 'vitest';
import { page } from 'vitest/browser';
import { flushSync,mount,unmount } from 'svelte';
import Panel from '../../src/lib/calendar/CalendarEntryPanel.svelte';
import { createCalendarDisplay,toCalendarItems } from '../../src/lib/calendar/calendar.ts';
import { bridgeState } from '../helpers/calendar-admin/state.svelte.ts';
let component:ReturnType<typeof mount>|undefined,target:HTMLElement|undefined;
afterEach(async()=>{if(component)await unmount(component);component=undefined;target?.remove();target=undefined;});
function render(){
  target=document.createElement('div');document.body.append(target);
  const now=Date.now(),item=toCalendarItems([{collection:'posts',id:'launch',locale:'en',title:'Launch',kind:'scheduled',status:'scheduled',at:new Date(2030,9,20,9,0).toISOString()}],{timeZone:'UTC',loadedAt:now,collectionOrder:['posts']})[0]!;
  const display=createCalendarDisplay({locale:'en',timeZone:'UTC',viewerTimeZone:'UTC',collections:[{slug:'posts',label:'Posts'}],showLocale:false});
  const onClose=vi.fn(),client={fetchContent:vi.fn().mockResolvedValue({id:'launch',type:'posts',locale:'en',updatedAt:new Date().toISOString(),authorId:'editor',_rev:'rev-1'}),publishContent:vi.fn(),unscheduleContent:vi.fn(),scheduleContent:vi.fn()};
  const state=bridgeState({item,display,now,compact:false,user:{id:'editor',email:'editor@example.com',role:40},client,onClose,onRescheduled:vi.fn()});
  component=flushSync(()=>mount(Panel,{target:target!,props:state as any}));
  return {state,onClose,panel:page.getByRole('dialog',{name:'Launch'})};
}
describe('Native calendar panel context',()=>{
  it('updates actual modality when the open panel crosses the compact breakpoint',async()=>{
    const {state,panel,onClose}=render();
    await expect.element(panel).toBeVisible();
    await expect.poll(()=>document.querySelector('dialog')!.matches(':modal')).toBe(false);
    flushSync(()=>{state.compact=true;});
    await expect.poll(()=>document.querySelector('dialog')!.matches(':modal')).toBe(true);
    flushSync(()=>{state.compact=false;});
    await expect.poll(()=>document.querySelector('dialog')!.matches(':modal')).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });
  it('keeps an in-progress schedule open across a same-key entry refresh',async()=>{
    const {state,panel}=render();
    await panel.getByRole('button',{name:'Reschedule'}).click();
    const schedule=page.getByRole('dialog',{name:'Change schedule'});
    await expect.element(schedule).toBeVisible();
    await schedule.getByRole('textbox',{name:'Minute'}).fill('30');
    flushSync(()=>{state.item={...(state.item as object)};});
    await expect.poll(()=>Boolean(document.querySelector<HTMLDialogElement>('dialog[aria-labelledby="calendar-schedule-title"]')?.open)).toBe(true);
    await expect.element(schedule).toBeVisible();
    await expect.element(schedule.getByRole('textbox',{name:'Minute'})).toHaveValue('30');
  });
});
