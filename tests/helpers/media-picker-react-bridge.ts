import * as React from 'react';
import {mount,unmount} from 'svelte';
import Harness from './MediaPickerNativeHarness.svelte';
import {bridgeState} from './media-picker-state.svelte';
import * as api from './media-picker-api-host';
import {useCurrentUser} from './media-picker-current-user';
export function MediaPickerModal(props:any){
 const target=React.useRef<HTMLDivElement>(null);
 const state=React.useRef<ReturnType<typeof bridgeState>|null>(null);
 const options={...props,client:api,currentUser:useCurrentUser().data};
 if(!state.current)state.current=bridgeState(options);
 React.useLayoutEffect(()=>{Object.assign(state.current!,options);});
 React.useLayoutEffect(()=>{const instance=mount(Harness,{target:target.current!,props:state.current!});return()=>{void unmount(instance);};},[]);
 return React.createElement('div',{ref:target});
}
