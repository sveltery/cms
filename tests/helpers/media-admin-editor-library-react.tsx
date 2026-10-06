import * as React from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {DndContext} from '@dnd-kit/core';
import {mount,unmount,flushSync} from 'svelte';
import NativeLibrary from '../../src/lib/media/MediaLibrary.svelte';
import {nativeMediaState} from './media-admin-editor-state.svelte';
import {useCurrentUser} from './media-picker-current-user';
import {mediaPermissionsForUser} from '../../src/lib/media/permissions';

export function MediaLibrary(props:Record<string,unknown>) {
  const target=React.useRef<HTMLDivElement>(null);
  const currentUser=useCurrentUser().data;
  const queryClient=useQueryClient();
  const mounted=React.useRef<ReturnType<typeof mount>|null>(null);
  const options={...props,initialItems:props.items??[],queryClient,currentUser,permissions:mediaPermissionsForUser(currentUser),actorId:currentUser?.id??'',onselect:props.onSelect};
  const state=React.useRef<ReturnType<typeof nativeMediaState>|null>(null);
  if(!state.current)state.current=nativeMediaState(options);
  React.useLayoutEffect(()=>{flushSync(()=>Object.assign(state.current!,options));});
  React.useLayoutEffect(()=>{flushSync(()=>{mounted.current=mount(NativeLibrary,{target:target.current!,props:state.current as never});});return()=>{if(mounted.current)void unmount(mounted.current);mounted.current=null;};},[]);
  const forward=(name:string,event:unknown)=>{
    const handler=(mounted.current as unknown as Record<string,unknown>|null)?.[name];
    if(typeof handler!=='function')throw new Error(`Real Native Library ${name} handler is unavailable`);
    flushSync(()=>handler(event));
  };
  return React.createElement(DndContext as unknown as React.ComponentType<React.PropsWithChildren<Record<string,unknown>>>,{
    onDragStart:(event:unknown)=>forward('mediaDragStart',event),
    onDragEnd:(event:unknown)=>forward('mediaDragEnd',event),
    onDragCancel:(event:unknown)=>forward('mediaDragCancel',event),
  },React.createElement('div',{ref:target}));
}
