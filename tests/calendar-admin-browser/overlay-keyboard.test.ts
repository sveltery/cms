// Supplemental Native focus/keyboard controls exercise actual browser DOM.
// No modal, focus, layout or event polyfills and no protected transport probes.
import { afterEach,describe,expect,it,vi } from 'vitest';
import { page,userEvent } from 'vitest/browser';
import { flushSync,mount,unmount } from 'svelte';
import Filters from '../../src/lib/calendar/CalendarFilters.svelte';
import Month from '../../src/lib/calendar/CalendarMonth.svelte';
import { createCalendarDisplay,groupByDay,monthGridDays,toCalendarItems } from '../../src/lib/calendar/calendar.ts';
import { bridgeState } from '../helpers/calendar-admin/state.svelte.ts';
let component:ReturnType<typeof mount>|undefined,target:HTMLElement|undefined;
afterEach(async()=>{if(component)await unmount(component);component=undefined;target?.remove();target=undefined;});
function host(){target=document.createElement('div');document.body.append(target);}
const display=createCalendarDisplay({locale:'en',timeZone:'UTC',viewerTimeZone:'UTC',collections:[{slug:'posts',label:'Posts'},{slug:'pages',label:'Pages'}]});
const now=Date.parse('2030-10-15T12:00:00Z');
function renderMonth(compact=false){
  host();const items=toCalendarItems(Array.from({length:5},(_,i)=>({collection:'posts',id:`entry-${i}`,locale:'en',title:`Entry ${i}`,kind:'scheduled' as const,status:'scheduled' as const,at:`2030-10-20T0${i}:00:00.000Z`})),{timeZone:'UTC',loadedAt:now,collectionOrder:['posts']});
  const state=bridgeState({month:'2030-10',gridDays:monthGridDays('2030-10',0),days:groupByDay(items),today:'2030-10-15',now,display,compact,onMonthChange:vi.fn()});
  component=flushSync(()=>mount(Month,{target:target!,props:state as any}));return state;
}
describe('Native calendar overlay keyboard behavior',()=>{
  it('moves focus into filters and restores the trigger on immediate Escape',async()=>{
    host();component=flushSync(()=>mount(Filters,{target:target!,props:{display,collections:[{slug:'posts',label:'Posts'},{slug:'pages',label:'Pages'}],locales:[],value:{collections:[],locales:[],states:[]},onChange:vi.fn()}}));
    const trigger=page.getByRole('button',{name:'Filter',exact:true});await trigger.click();
    await expect.poll(()=>document.activeElement?.textContent).toBe('Posts');
    await userEvent.keyboard('{ArrowDown}');
    await expect.poll(()=>document.activeElement?.textContent).toBe('Pages');
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('menu',{name:'Calendar filters'})).not.toBeInTheDocument();
    await expect.poll(()=>document.activeElement===trigger.element()).toBe(true);
  });
  it('focuses the busy-day popup and closes it on immediate Escape',async()=>{
    renderMonth();const trigger=page.getByRole('button',{name:/2 more entries/});await trigger.click();
    await expect.poll(()=>Boolean(document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
    await expect.poll(()=>document.activeElement===trigger.element()).toBe(true);
  });
  it('retains a day-grid tab stop after keyboard movement and toolbar month navigation',async()=>{
    const state=renderMonth(true);
    await page.getByRole('button',{name:/October 15th, 2030/}).press('ArrowRight');
    await expect.poll(()=>document.activeElement?.getAttribute('data-calendar-day')).toBe('2030-10-16');
    flushSync(()=>{state.month='2030-11';state.gridDays=monthGridDays('2030-11',0);});
    await expect.poll(()=>document.querySelectorAll('[data-calendar-day][tabindex="0"]').length).toBe(1);
    await page.getByRole('button',{name:/November 5th, 2030/}).click();
    await expect.poll(()=>document.querySelector('[data-calendar-day][tabindex="0"]')?.getAttribute('data-calendar-day')).toBe('2030-11-05');
  });
});
