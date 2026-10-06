// Test transport only: whole Original React tests mount the actual Native Svelte notice/controller.
// No credential, protected HTTP, geometry, dialog or timer mocks are introduced.
import * as React from 'react';
import {mount,unmount} from 'svelte';
import NativeEntryLockNotice from '../../../src/lib/entry-locks/EntryLockNotice.svelte';
import {createEntryLockController,type EntryLockInput,type EntryLockState} from '../../../src/lib/entry-locks/controller.ts';
import {acquireEntryLock,releaseEntryLock,entryLockRefusal} from '../../../src/lib/entry-locks/client.ts';
export {ENTRY_LOCK_HEARTBEAT_MS} from '../../../src/lib/entry-locks/controller.ts';
export type {EntryLockState};
export function EntryLockNotice(props:{state:EntryLockState;onTakeOver:()=>void;onReadInstead:()=>void;isTakingOver:boolean}) {
 const target=React.useRef<HTMLSpanElement>(null);
 React.useLayoutEffect(()=>{
  if(!target.current)return;
  const app=mount(NativeEntryLockNotice,{target:target.current,props});
  return()=>{void unmount(app);};
 },[props.state,props.onTakeOver,props.onReadInstead,props.isTakingOver]);
 return <span ref={target}/>;
}
export function useEntryLock(input:EntryLockInput){
 const reference=React.useRef<ReturnType<typeof createEntryLockController>|null>(null);
 if(!reference.current)reference.current=createEntryLockController(input,{acquire:acquireEntryLock,release:releaseEntryLock,refusal:entryLockRefusal});
 const controller=reference.current;
 const value=React.useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot);
 React.useEffect(()=>{controller.replace(input);return controller.stop;},[controller,input.collection,input.entryId,input.locale,input.ready]);
 return {...value,takeOver:controller.takeOver,readInstead:controller.readInstead,reportWriteError:controller.reportWriteError};
}
