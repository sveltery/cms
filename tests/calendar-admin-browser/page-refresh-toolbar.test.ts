// Supplemental Native UI controls derived from the complete pinned Calendar
// query/toolbar behavior. Controlled promises/clocks exercise no HTTP, session,
// canonical storage or live authorization; original Source callbacks are intact.
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { flushSync,mount,unmount } from 'svelte';
import { QueryClient } from '@tanstack/react-query';
import Page from '../../src/lib/calendar/CalendarPage.svelte';
import { ApiResponseError } from '../../src/lib/sections-widgets/client.ts';
const controlled=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('../../src/lib/calendar/api.ts',async importOriginal=>{
  const original=await importOriginal<typeof import('../../src/lib/calendar/api.ts')>();
  return {...original,calendarQueryOptions:(from:string,to:string)=>({...original.calendarQueryOptions(from,to),queryFn:controlled.fetch})};
});
let component:ReturnType<typeof mount>|undefined,target:HTMLElement|undefined,queryClient:QueryClient|undefined;
beforeEach(()=>{vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout','setInterval','clearInterval']});vi.setSystemTime(new Date('2030-10-15T12:00:00.000Z'));controlled.fetch.mockReset();});
afterEach(async()=>{if(component)await unmount(component);component=undefined;queryClient?.clear();queryClient=undefined;target?.remove();target=undefined;vi.useRealTimers();});
function render(month='2030-10'){
  target=document.createElement('div');document.body.append(target);queryClient=new QueryClient();
  component=flushSync(()=>mount(Page,{target:target!,props:{manifest:{timezone:'UTC',collections:{posts:{label:'Posts'}}},client:{fetchContent:vi.fn(),publishContent:vi.fn(),unscheduleContent:vi.fn(),scheduleContent:vi.fn()},queryClient:queryClient!,search:{month},updateSearch:vi.fn(),back:vi.fn()}}));
}
async function settle(){await vi.advanceTimersByTimeAsync(0);flushSync();}
describe('Native Calendar query clock and toolbar',()=>{
  it('keeps a successful non-current range idle at the next minute boundary',async()=>{
    controlled.fetch.mockResolvedValue({items:[],truncated:false});render('2031-02');await settle();
    expect(controlled.fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);flushSync();
    expect(controlled.fetch).toHaveBeenCalledTimes(1);
  });
  it('keeps a terminal-error range idle at the next minute boundary',async()=>{
    controlled.fetch.mockRejectedValue(new ApiResponseError(403,'FORBIDDEN','No calendar permission'));render();await settle();
    expect(controlled.fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);flushSync();
    expect(controlled.fetch).toHaveBeenCalledTimes(1);
  });
  it('shows the toolbar loading indicator while the supplied query is pending',()=>{
    controlled.fetch.mockImplementation(()=>new Promise(()=>{}));render();
    expect(target!.querySelector('.toolbar [aria-label="Loading"]')).not.toBeNull();
  });
});
