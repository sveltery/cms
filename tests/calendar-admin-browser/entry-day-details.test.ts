// Supplemental Native display/focus controls from whole pinned CalendarEntry,
// Agenda and compact Month. Actual production Svelte/Intl/browser focus; zero
// transport, session, authorization, storage or original Source test credit.
import { afterEach,describe,expect,it } from 'vitest';
import { page } from 'vitest/browser';
import { flushSync,mount,unmount } from 'svelte';
import Entry from '../../src/lib/calendar/CalendarEntry.svelte';
import Agenda from '../../src/lib/calendar/CalendarAgenda.svelte';
import Month from '../../src/lib/calendar/CalendarMonth.svelte';
import { createCalendarDisplay,groupByDay,monthGridDays,toCalendarItems } from '../../src/lib/calendar/calendar.ts';
let component:ReturnType<typeof mount>|undefined,target:HTMLElement|undefined;
afterEach(async()=>{if(component)await unmount(component);component=undefined;target?.remove();target=undefined;});
const now=Date.parse('2030-10-15T12:00:00Z'),display=createCalendarDisplay({locale:'en',timeZone:'UTC',viewerTimeZone:'America/New_York',collections:[{slug:'posts',label:'Posts'}],showLocale:false});
const items=toCalendarItems([15,16].map(day=>({collection:'posts',id:`entry-${day}`,locale:'en',title:`Full launch title for October ${day}`,kind:'scheduled' as const,status:'scheduled',at:`2030-10-${day}T13:00:00Z`})),{timeZone:'UTC',loadedAt:now,collectionOrder:['posts']});
function host(){target=document.createElement('div');document.body.append(target);}
function renderAgenda(){host();component=flushSync(()=>mount(Agenda,{target:target!,props:{month:'2030-10',days:groupByDay(items),today:'2030-10-15',now,display}}));}
describe('Native Calendar entry and day details',()=>{
  it('exposes the complete month-chip details on actual keyboard focus',async()=>{
    host();const item=items[0]!;component=flushSync(()=>mount(Entry,{target:target!,props:{item,display,now,chip:true}}));
    target!.querySelector('a')!.focus();
    await expect.poll(()=>Boolean(target!.querySelector('[role="tooltip"]'))).toBe(true);
    await expect.element(page.getByRole('tooltip')).toBeVisible();
    const text=target!.querySelector('[role="tooltip"]')!.textContent!;
    expect(text).toContain(item.title);expect(text).toContain('Scheduled');expect(text).toContain(display.formatDateTime(item.time));expect(text).toContain(`Your time: ${display.formatViewerTime(item.time)}`);expect(text).toContain('Posts');
  });
  it('names agenda day regions through their actual headings',()=>{
    renderAgenda();const regions=Array.from(target!.querySelectorAll('section[aria-labelledby]'));
    expect(regions).toHaveLength(2);
    for(const region of regions)expect(document.getElementById(region.getAttribute('aria-labelledby')!)?.textContent).toBeTruthy();
  });
  it('labels today and tomorrow in the agenda day headings',()=>{
    renderAgenda();const headings=Array.from(target!.querySelectorAll('h3'),heading=>heading.textContent);
    expect(headings[0]).toContain('Today');expect(headings[1]).toContain('Tomorrow');
  });
  it('labels and names the selected current day in compact month view',()=>{
    host();component=flushSync(()=>mount(Month,{target:target!,props:{month:'2030-10',gridDays:monthGridDays('2030-10',0),days:groupByDay(items),today:'2030-10-15',now,display,compact:true,onMonthChange:()=>{}}}));
    expect(target!.querySelector('section h3')?.textContent).toContain('Today');
    expect(target!.querySelector('section[aria-labelledby]')).not.toBeNull();
  });
});
