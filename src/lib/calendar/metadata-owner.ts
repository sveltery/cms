// EmDash1.1.0 manifest/currentUser query ownership, pin913cb1bb/MIT.
// Native SSR seeds are an explicit hosting adaptation, not Source HTTP credit.
// The actual page-supplied QueryClient remains the sole cache/focus owner.
import {QueryObserver,type QueryClient} from '@tanstack/react-query';
import type {CalendarManifest,CalendarUser} from './ui-types.ts';
export interface CalendarMetadata {manifest:CalendarManifest|undefined;user:CalendarUser|null|undefined}
export interface CalendarMetadataReaders {fetchManifest:()=>Promise<CalendarManifest>;fetchCurrentUser:()=>Promise<CalendarUser|null>}
export function observeCalendarMetadata(client:QueryClient,readers:CalendarMetadataReaders,initial:CalendarMetadata,apply:(value:CalendarMetadata)=>void){
  let snapshot={...initial},userObserver:QueryObserver<CalendarUser|null>|undefined,stopUser=()=>{};
  function updateUser(result:ReturnType<QueryObserver<CalendarUser|null>['getCurrentResult']>){snapshot={...snapshot,user:result.data};apply(snapshot);}
  function startUser(){
    if(userObserver)return;
    userObserver=new QueryObserver<CalendarUser|null>(client,{queryKey:['currentUser'],queryFn:readers.fetchCurrentUser,staleTime:300000,retry:false,initialData:initial.user});
    stopUser=userObserver.subscribe(updateUser);updateUser(userObserver.getCurrentResult());
  }
  const manifestObserver=new QueryObserver<CalendarManifest>(client,{queryKey:['manifest'],queryFn:readers.fetchManifest,initialData:initial.manifest});
  function updateManifest(result:ReturnType<typeof manifestObserver.getCurrentResult>){
    snapshot={...snapshot,manifest:result.data};apply(snapshot);
    if(result.data)startUser();else if(userObserver){stopUser();userObserver.destroy();userObserver=undefined;}
  }
  const stopManifest=manifestObserver.subscribe(updateManifest);updateManifest(manifestObserver.getCurrentResult());
  return {
    refetchManifest:async()=>{const result=await manifestObserver.refetch();return result.data;},
    refetchUser:async()=>{const result=await userObserver?.refetch();return result?.data;},
    destroy(){stopManifest();manifestObserver.destroy();stopUser();userObserver?.destroy();},
  };
}
