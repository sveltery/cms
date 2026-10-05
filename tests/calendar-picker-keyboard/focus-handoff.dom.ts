// Supplemental mounted production focus handoff from the unchanged original
// CalendarMonth last-day callback. Controlled jsdom has no physical browser,
// original callback, URL/session/storage/protected transport or geometry credit.
import {afterEach,expect,it} from 'vitest';
import {mount,tick,unmount} from 'svelte';
import {i18n} from '@lingui/core';
import Owner from '../helpers/calendar-admin/DeferredPickerMonth.svelte';
let component:ReturnType<typeof mount>|undefined,target:HTMLElement|undefined;
afterEach(async()=>{if(component)await unmount(component);component=undefined;target?.remove();target=undefined;});
it.each([
  ['2026-10-31','ArrowRight','2026-11','2026-11-01'],
  ['2026-10-01','ArrowLeft','2026-09','2026-09-30'],
])('retains the requested target when %s blurs before the caller applies its new month',async(day,key,month,next)=>{
  i18n.loadAndActivate({locale:'en',messages:{}});
  target=document.createElement('div');document.body.append(target);component=mount(Owner,{target});await tick();
  const current=target.querySelector<HTMLButtonElement>(`[data-calendar-day="${day}"]`)!;
  current.focus();await tick();
  current.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));await tick();
  const apply=target.querySelector<HTMLButtonElement>('[data-pending-month]')!;
  expect(apply.getAttribute('data-pending-month')).toBe(month);
  current.blur();await tick();apply.click();await tick();await tick();
  expect(document.activeElement?.getAttribute('data-calendar-day')).toBe(next);
});
