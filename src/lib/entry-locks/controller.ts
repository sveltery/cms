// EmDash 1.1.0 useEntryLock lifecycle transported to one Native controller.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import type { EntryLockHolder,EntryLockStatus } from './client.ts';
export type EntryLockState=
 | {status:'pending'} | {status:'disabled'} | {status:'unreachable'} | {status:'holding'}
 | {status:'blocked';holder:EntryLockHolder} | {status:'reading';holder:EntryLockHolder}
 | {status:'taken';holder:EntryLockHolder};
export interface EntryLockInput {collection:string;entryId:string;locale?:string;ready:boolean}
export interface EntryLockSnapshot {state:EntryLockState;readOnly:boolean;isTakingOver:boolean}
export interface EntryLockApi {
 acquire(collection:string,id:string,options:{locale?:string;takeover?:boolean;token?:string}):Promise<EntryLockStatus>;
 release(collection:string,id:string,options:{locale?:string;token?:string;keepalive?:boolean}):Promise<void>;
 refusal(error:unknown):EntryLockHolder|null;
}
export const ENTRY_LOCK_HEARTBEAT_MS=2*60*1000;
function sessionToken():string {
 return globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** The component owns start/stop; the API still owns the sole server lease writer. */
export function createEntryLockController(initial:EntryLockInput,api:EntryLockApi,
 documentTarget:EventTarget & {readonly visibilityState?:string}=document,
 windowTarget:EventTarget=window) {
 let input=initial,state:EntryLockState={status:'pending'},isTakingOver=false;
 let holdsLock=false,generation=0,cleanup:(()=>void)|undefined;
 const token=sessionToken(),listeners=new Set<()=>void>();
 let view:EntryLockSnapshot={state,readOnly:false,isTakingOver};
 let scheduleHeartbeat=()=>{};
 function publish(){view={state,readOnly:state.status==='blocked'||state.status==='reading'||state.status==='taken',isTakingOver};for(const listener of listeners)listener();}
 function commit(next:EntryLockState){state=next;publish();}
 function stop(){cleanup?.();cleanup=undefined;}
 function start(){
  stop();
  const {collection,entryId,locale,ready}=input;
  if(!ready)return;
  generation+=1;
  let cancelled=false,timer:ReturnType<typeof setTimeout>|null=null;
  state={status:'pending'};isTakingOver=false;holdsLock=false;publish();
  const apply=(status:EntryLockStatus):boolean=>{
   if(!status.enabled){holdsLock=false;commit({status:'disabled'});return false;}
   if(status.heldByCaller||!status.holder){holdsLock=status.heldByCaller;commit({status:'holding'});return true;}
   holdsLock=false;
   const previous=state.status,holder=status.holder;
   if(previous==='holding'||previous==='taken'){commit({status:'taken',holder});return false;}
   commit(previous==='reading'?{status:'reading',holder}:{status:'blocked',holder});return true;
  };
  const schedule=()=>{
   if(timer)clearTimeout(timer);
   if(cancelled)return;
   timer=setTimeout(()=>void beat(),ENTRY_LOCK_HEARTBEAT_MS);
  };
  scheduleHeartbeat=schedule;
  const beat=async()=>{
   if(cancelled)return;
   const current=state.status;
   if(current==='disabled'||current==='taken')return;
   try{
    const status=await api.acquire(collection,entryId,{locale,token});
    if(cancelled){if(status.heldByCaller)void api.release(collection,entryId,{locale,token}).catch(()=>undefined);return;}
    if(apply(status))schedule();
   }catch{if(cancelled)return;if(state.status==='pending')commit({status:'unreachable'});schedule();}
  };
  const onVisibilityChange=()=>{
   if(documentTarget.visibilityState!=='visible')return;
   if(timer)clearTimeout(timer);
   void beat();
  };
  const onPageHide=()=>{
   if(!holdsLock)return;
   holdsLock=false;
   void api.release(collection,entryId,{locale,token,keepalive:true}).catch(()=>undefined);
  };
  documentTarget.addEventListener('visibilitychange',onVisibilityChange);
  windowTarget.addEventListener('pagehide',onPageHide);
  cleanup=()=>{
   cancelled=true;
   if(timer)clearTimeout(timer);
   documentTarget.removeEventListener('visibilitychange',onVisibilityChange);
   windowTarget.removeEventListener('pagehide',onPageHide);
   scheduleHeartbeat=()=>{};
   if(!holdsLock)return;
   holdsLock=false;
   void api.release(collection,entryId,{locale,token}).catch(()=>undefined);
  };
  void beat();
 }
 function takeOver(){
  const askedGeneration=generation;
  const {collection,entryId,locale}=input;
  isTakingOver=true;publish();
  void(async()=>{
   try{
    const status=await api.acquire(collection,entryId,{locale,takeover:true,token});
    if(!status.heldByCaller)return;
    if(askedGeneration!==generation){await api.release(collection,entryId,{locale,token}).catch(()=>undefined);return;}
    holdsLock=true;commit({status:'holding'});scheduleHeartbeat();
   }catch{
   }finally{if(askedGeneration===generation){isTakingOver=false;publish();}}
  })();
 }
 function readInstead(){if(state.status==='blocked')commit({status:'reading',holder:state.holder});}
 function reportWriteError(error:unknown,writtenEntryId:string):boolean {
  const holder=api.refusal(error);
  if(!holder||writtenEntryId!==input.entryId)return false;
  holdsLock=false;commit({status:'taken',holder});return true;
 }
 return {start,stop,takeOver,readInstead,reportWriteError,
  replace(next:EntryLockInput){input=next;start();},
  snapshot:()=>view,
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
 };
}
