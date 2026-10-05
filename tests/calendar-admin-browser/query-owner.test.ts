// Native lifecycle controls for the actual Calendar page client owner. These
// use controlled promises and browser focus/reconnect events, without HTTP,
// credential/session, canonical storage or original Source execution credit.
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { flushSync,mount,unmount } from 'svelte';
import { QueryObserver,type QueryClient } from '@tanstack/react-query';
import Owner from '../helpers/calendar-admin/QueryClientOwner.svelte';
const owners=import.meta.glob('../../src/lib/calendar/query-client.ts');
let component:ReturnType<typeof mount>|undefined,target:HTMLElement|undefined,client:QueryClient|undefined;
let cleanup:(()=>void)|undefined;
beforeEach(()=>{vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout','setInterval','clearInterval']});vi.setSystemTime(new Date('2030-10-15T12:00:00Z'));});
afterEach(async()=>{cleanup?.();cleanup=undefined;if(component)await unmount(component);component=undefined;client=undefined;target?.remove();target=undefined;vi.useRealTimers();});
async function render(){
  const producer=await owners['../../src/lib/calendar/query-client.ts']?.() as {createCalendarQueryClient?:()=>QueryClient}|undefined;
  expect(producer?.createCalendarQueryClient).toBeTypeOf('function');
  target=document.createElement('div');document.body.append(target);
  component=flushSync(()=>mount(Owner,{target:target!,props:{create:producer!.createCalendarQueryClient!,onReady:value=>client=value}}));
}
async function settle(){await vi.advanceTimersByTimeAsync(0);flushSync();}
describe('Native Calendar query-client owner',()=>{
  it('inherits exactly one retry for failed detail reads',async()=>{
    await render();const fetch=vi.fn().mockRejectedValue(new Error('Controlled detail failure'));
    const observer=new QueryObserver(client!,{queryKey:['content','posts','launch'],queryFn:fetch,staleTime:0,retryDelay:0});cleanup=observer.subscribe(()=>{});
    await settle();await settle();
    expect(fetch).toHaveBeenCalledTimes(2);expect(observer.getCurrentResult().isError).toBe(true);
  });
  it('keeps inherited translations fresh for the Source one-minute window',async()=>{
    await render();const fetch=vi.fn().mockResolvedValue({translations:[]});
    await client!.fetchQuery({queryKey:['translations','posts','launch'],queryFn:fetch});
    const observer=new QueryObserver(client!,{queryKey:['translations','posts','launch'],queryFn:fetch});cleanup=observer.subscribe(()=>{});
    await settle();expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('refreshes a stale observed detail when browser focus returns',async()=>{
    await render();const fetch=vi.fn().mockResolvedValue({title:'Launch'});
    const observer=new QueryObserver(client!,{queryKey:['content','posts','launch'],queryFn:fetch,staleTime:0});cleanup=observer.subscribe(()=>{});await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('visibilitychange'));await settle();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('refreshes a stale observed detail when connectivity returns',async()=>{
    await render();const fetch=vi.fn().mockResolvedValue({title:'Launch'});
    const observer=new QueryObserver(client!,{queryKey:['content','posts','launch'],queryFn:fetch,staleTime:0});cleanup=observer.subscribe(()=>{});await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('offline'));window.dispatchEvent(new Event('online'));await settle();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
