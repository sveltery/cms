/** Test-only framework mount; original API mocks, supplied QueryClient and props remain unchanged. */
import * as React from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {mount,unmount,flushSync,type ComponentProps} from 'svelte';
import NativeUsedIn from '../../src/lib/media/MediaUsedIn.svelte';
import {mediaPanelState} from './media-panel-state.svelte';
export function MediaUsedIn(props:ComponentProps<typeof NativeUsedIn>){
 const queryClient=useQueryClient(props.queryClient),target=React.useRef<HTMLDivElement>(null),state=React.useRef<ReturnType<typeof mediaPanelState>|null>(null);
 if(!state.current)state.current=mediaPanelState({...props,queryClient});
 React.useLayoutEffect(()=>{flushSync(()=>Object.assign(state.current!,props,{queryClient}));});
 React.useLayoutEffect(()=>{let instance:ReturnType<typeof mount>;flushSync(()=>{instance=mount(NativeUsedIn,{target:target.current!,props:state.current as unknown as ComponentProps<typeof NativeUsedIn>});});return()=>{void unmount(instance!);};},[]);
 return React.createElement('div',{ref:target});
}
