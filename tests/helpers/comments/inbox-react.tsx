// Original React-to-Svelte mounting transport for WHOLE unchanged Source tests.
import * as React from 'react';
import { mount, flushSync, unmount } from 'svelte';
import Host from './InboxHost.svelte';
import type { CommentInboxProps } from '../../../src/lib/comments/types.ts';
export function CommentInbox(props:CommentInboxProps){
 const target=React.useRef<HTMLDivElement>(null);
 const instance=React.useRef<ReturnType<typeof mount>|null>(null);
 React.useLayoutEffect(()=>{instance.current=flushSync(()=>mount(Host,{target:target.current!,props:{initial:props}}));return()=>{void unmount(instance.current!);instance.current=null;};},[]);
 React.useLayoutEffect(()=>{(instance.current as {update:(value:CommentInboxProps)=>void}|null)?.update(props);},[props]);
 return React.createElement('div',{ref:target});
}
