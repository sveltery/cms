// Supplemental closed production dialog/form callbacks with supplied catalogs.
// Exact Source validationMessage descriptors; no original callback, physical
// browser/modal/focus/geometry or protected transport/storage credit.
import {afterEach,expect,it} from 'vitest';
import {createRequire} from 'node:module';
import {mount,tick,unmount} from 'svelte';
import {i18n} from '@lingui/core';
import Schedule from '../../src/lib/calendar/CalendarScheduleDialog.svelte';
import Owner from './ValidationOwner.svelte';
const require=createRequire(import.meta.url),coreRequire=createRequire(require.resolve('@lingui/core/package.json'));
const {generateMessageId}=coreRequire('@lingui/message-utils/generateMessageId');
const messages=[
  ['Choose a date','Choisissez une date'],
  ['Choose a time','Choisissez une heure'],
  ['Choose a time in the future','Choisissez une heure dans le futur'],
  ['That time does not exist in your time zone',"Cette heure n’existe pas dans votre fuseau horaire"],
  ['Choose a valid date and time','Choisissez une date et une heure valides'],
] as const;
let component:ReturnType<typeof mount>|undefined,target:HTMLElement|undefined;
afterEach(async()=>{if(component)await unmount(component);component=undefined;target?.remove();target=undefined;i18n.loadAndActivate({locale:'en',messages:{}});});
async function render(scheduledAt:string|null=null,withOwner=false){
  i18n.loadAndActivate({locale:'fr',messages:Object.fromEntries(messages.map(([message,translated])=>[generateMessageId(message),[translated]]))});
  target=document.createElement('div');document.body.append(target);
  component=withOwner?mount(Owner,{target}):mount(Schedule,{target,props:{open:false,entryKey:'posts:entry:scheduled',locale:'fr',scheduledAt,onOpenChange(){},onSchedule(){throw Error('invalid input must not schedule');}}});await tick();
}
async function submit(){target!.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await tick();}
async function hour(value:string){const input=target!.querySelector<HTMLInputElement>('input[aria-label="Hour"]')!;input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));await tick();}
const error=()=>target!.querySelector('[role="alert"]')?.textContent?.trim();
it('translates missing-date at the actual submission boundary',async()=>{await render();await submit();expect(error()).toBe(messages[0][1]);});
it('translates missing-time from the actual shared field callback',async()=>{await render('2035-06-15T13:00:00Z');await hour('');await submit();expect(error()).toBe(messages[1][1]);});
it('translates past time from the actual serializer result',async()=>{await render('2026-10-01T13:00:00Z');await submit();expect(error()).toBe(messages[2][1]);});
it('translates a New York DST gap from the actual segmented fields and serializer',async()=>{await render('2035-03-11T06:30:00Z');await hour('02');await submit();expect(error()).toBe(messages[3][1]);});
it('retains the translated validation string after a later locale/catalog change',async()=>{
  await render(null,true);await submit();
  i18n.loadAndActivate({locale:'en',messages:{[generateMessageId(messages[0][0])]:['A later replacement'],[generateMessageId('Schedule publication')]:['Later title']}});await tick();
  expect(target!.querySelector('h2')?.textContent).toBe('Later title');
  expect(error()).toBe(messages[0][1]);
});
