import * as React from 'react';
import {mount,unmount,flushSync} from 'svelte';
import NativeLibrary from '../../src/lib/media/MediaLibrary.svelte';
import {nativeMediaState} from './media-admin-editor-state.svelte';
import {useCurrentUser} from './media-picker-current-user';
import {mediaPermissionsForUser} from '../../src/lib/media/permissions';

export function MediaLibrary(props:Record<string,unknown>) {
  const target=React.useRef<HTMLDivElement>(null);
  const currentUser=useCurrentUser().data;
  const options={...props,initialItems:props.items??[],permissions:mediaPermissionsForUser(currentUser),actorId:currentUser?.id??'',onselect:props.onSelect};
  const state=React.useRef<ReturnType<typeof nativeMediaState>|null>(null);
  if(!state.current)state.current=nativeMediaState(options);
  React.useLayoutEffect(()=>{flushSync(()=>Object.assign(state.current!,options));});
  React.useLayoutEffect(()=>{let instance:ReturnType<typeof mount>;flushSync(()=>{instance=mount(NativeLibrary,{target:target.current!,props:state.current as never});});return()=>{void unmount(instance!);};},[]);
  return React.createElement('div',{ref:target});
}
