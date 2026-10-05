// Supplemental actual DOM geometry in official sandboxed Chromium1243.
// Synthetic mouse events are controlled transport, not physical hit-testing,
// original Source callbacks, protected HTTP/session/storage or CSS-body credit.
import {afterEach,expect,it} from 'vitest';
import {mount,tick,unmount} from 'svelte';
import {i18n} from '@lingui/core';
import Entry from '../../src/lib/calendar/CalendarEntry.svelte';
import {createCalendarDisplay,type CalendarItem} from '../../src/lib/calendar/calendar.ts';
let mounted:ReturnType<typeof mount>|undefined;
const item:CalendarItem={collection:'posts',id:'one',locale:'en',title:'A sufficiently long tooltip title for diagonal transit',status:'draft',kind:'scheduled',at:'2026-10-15T15:00:00Z',key:'posts:one:scheduled',time:Date.parse('2026-10-15T15:00:00Z'),day:'2026-10-15',state:'overdue'};
const display=createCalendarDisplay({locale:'en',timeZone:'America/New_York',collections:[],showLocale:false});
const mouse=(target:EventTarget,type:string,x:number,y:number)=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'mouse',clientX:x,clientY:y}));
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
afterEach(async()=>{if(mounted)await unmount(mounted);mounted=undefined;document.body.replaceChildren();});
async function opened(left=400,top=240){
  i18n.loadAndActivate({locale:'en',messages:{}});
  const host=document.createElement('div');host.style.cssText=`position:fixed;left:${left}px;top:${top}px;width:130px`;document.body.append(host);
  mounted=mount(Entry,{target:host,props:{item,display,now:Date.parse('2026-10-15T16:00:00Z'),chip:true}});await tick();
  const anchor=host.querySelector('a')!;const box=anchor.getBoundingClientRect();mouse(anchor,'pointerenter',box.left+20,box.top+10);mouse(anchor,'pointermove',box.left+20,box.top+10);
  await expect.poll(()=>document.querySelector('[role="tooltip"]')).not.toBeNull();
  await expect.poll(()=>document.querySelector<HTMLElement>('[role="tooltip"]')?.style.opacity).not.toBe('0');
  return{anchor,tooltip:document.querySelector<HTMLElement>('[role="tooltip"]')!};
}
it('places the actual popup10px above its trigger and positions the Source arrow',async()=>{
  const{anchor,tooltip}=await opened();const trigger=anchor.getBoundingClientRect(),popup=tooltip.getBoundingClientRect();
  expect(tooltip.getAttribute('data-side')).toBe('top');expect(Math.abs(trigger.top-popup.bottom-10)).toBeLessThan(1);
  expect(Math.abs(trigger.left+trigger.width/2-popup.left-popup.width/2)).toBeLessThan(1);
  const arrow=tooltip.querySelector<HTMLElement>('.tooltip-arrow')!;expect(arrow.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 20 10');expect(arrow.style.left).not.toBe('');
});
it('keeps diagonal trigger-to-popup transit open and closes when leaving the popup',async()=>{
  const{anchor,tooltip}=await opened();const trigger=anchor.getBoundingClientRect(),popup=tooltip.getBoundingClientRect();
  mouse(anchor,'pointerleave',trigger.left,trigger.top);mouse(document.body,'pointermove',trigger.left-8,trigger.top-5);await tick();
  expect(tooltip.isConnected).toBe(true);
  mouse(tooltip,'pointermove',popup.left+popup.width/2,popup.top+popup.height/2);await wait(60);expect(tooltip.isConnected).toBe(true);
  mouse(tooltip,'pointerleave',popup.left-30,popup.top-30);await tick();expect(tooltip.isConnected).toBe(false);
});
it('repositions the actual popup when its trigger moves',async()=>{
  const{anchor,tooltip}=await opened();const before=tooltip.getBoundingClientRect().left;
  anchor.parentElement!.style.left='500px';document.dispatchEvent(new Event('scroll'));window.dispatchEvent(new Event('resize'));
  await expect.poll(()=>tooltip.getBoundingClientRect().left-before).toBeCloseTo(100,0);
});
