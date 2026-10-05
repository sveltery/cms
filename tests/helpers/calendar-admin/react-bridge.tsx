// Test-only JSX transport mounts actual production Svelte components.
// Original router/client fixtures remain controlled; no native URL/auth/storage credit.
import * as React from 'react';
import { flushSync,mount,unmount } from 'svelte';
import { i18n } from '@lingui/core';
import { useQueryClient,useQuery } from '@tanstack/react-query';
import { useNavigate,useSearch,useRouter } from '@tanstack/react-router';
import { useCurrentUser } from './current-user.ts';
import * as client from '../../../src/lib/calendar/client.ts';
import Harness from './NativeHarness.svelte';
import { bridgeState } from './state.svelte.ts';
export { isPlainClick } from '../../../src/lib/calendar/entry.ts';
function transport(kind:string,props:Record<string,unknown>) {
  const target=React.useRef<HTMLDivElement>(null),state=React.useRef<ReturnType<typeof bridgeState>|null>(null);
  if(!state.current)state.current=bridgeState(props);
  React.useLayoutEffect(()=>{flushSync(()=>Object.assign(state.current!,props));});
  React.useLayoutEffect(()=>{const component=flushSync(()=>mount(Harness,{target:target.current!,props:{state:state.current!,kind}}));return()=>{void unmount(component);};},[]);
  return <div ref={target}/>;
}
export function CalendarAgenda(props:Record<string,unknown>){return transport('Agenda',props);}
export function CalendarFilters(props:Record<string,unknown>){return transport('Filters',props);}
export function CalendarMonth(props:Record<string,unknown>){return transport('Month',props);}
export function CalendarEntryPanel(props:Record<string,unknown>){return transport('Panel',{...props,client,queryClient:useQueryClient()});}
export function CalendarPage(){
  const queryClient=useQueryClient(),navigate=useNavigate(),search=useSearch({strict:false}),router=useRouter();
  const manifest=useQuery({queryKey:['manifest'],queryFn:client.fetchManifest}),user=useCurrentUser();
  if(!manifest.data)return null;
  return transport('Page',{manifest:manifest.data,user:user.data,client,queryClient,locale:i18n.locale,search,
    updateSearch:(patch:object,push=false)=>navigate({to:'/calendar',search:(previous:object)=>({...previous,...patch}),replace:!push}),back:()=>router.history.back()});
}
