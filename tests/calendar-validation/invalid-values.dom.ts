// Supplemental finite supplied field callbacks; actual production closed dialog
// and original serializer. No fake globals or Source/browser/HTTP credit.
import {afterEach,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import {mount,tick,unmount} from 'svelte';
import {i18n} from '@lingui/core';
vi.mock('../../src/lib/ui/PublishingDateTimeFields.svelte',async()=>({default:(await import('./CallbackFields.svelte')).default}));
import Schedule from '../../src/lib/calendar/CalendarScheduleDialog.svelte';
const require=createRequire(import.meta.url),coreRequire=createRequire(require.resolve('@lingui/core/package.json'));
const {generateMessageId}=coreRequire('@lingui/message-utils/generateMessageId');
let component:ReturnType<typeof mount>|undefined,target:HTMLElement|undefined;
afterEach(async()=>{if(component)await unmount(component);component=undefined;target?.remove();target=undefined;i18n.loadAndActivate({locale:'en',messages:{}});});
it.each(['date','time'])('translates invalid %s supplied through the existing typed field callback',async(kind)=>{
  i18n.loadAndActivate({locale:'fr',messages:{[generateMessageId('Choose a valid date and time')]:['Choisissez une date et une heure valides']}});
  target=document.createElement('div');document.body.append(target);
  component=mount(Schedule,{target,props:{open:false,entryKey:'posts:entry:scheduled',locale:'fr',onOpenChange(){},onSchedule(){throw Error('invalid input must not schedule');}}});await tick();
  target.querySelector<HTMLButtonElement>(`[data-invalid-${kind}]`)!.click();await tick();
  target.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await tick();
  expect(target.querySelector('[role="alert"]')?.textContent?.trim()).toBe('Choisissez une date et une heure valides');
});
