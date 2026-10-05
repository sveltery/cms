// Extraction of actual Native range observer scope; pin913cb1bb/MIT.
// The app-supplied QueryClient remains the sole owner and cache.
import {QueryObserver,type QueryClient,type QueryObserverOptions} from '@tanstack/react-query';
import type {CalendarRange} from './api.ts';
export type CalendarRangeOptions=QueryObserverOptions<CalendarRange,Error,CalendarRange,CalendarRange,readonly ['calendar',string,string]>;
export type CalendarRangeObserver=QueryObserver<CalendarRange,Error,CalendarRange,CalendarRange,readonly ['calendar',string,string]>;
export function createCalendarRangeOwner(apply:(result:ReturnType<CalendarRangeObserver['getCurrentResult']>)=>void,changed:(observer:CalendarRangeObserver|undefined)=>void){
  let observer:CalendarRangeObserver|undefined,unsubscribe=()=>{},currentClient:QueryClient|undefined,currentKey:string|undefined;
  function destroy(){unsubscribe();observer?.destroy();observer=undefined;currentClient=undefined;currentKey=undefined;changed(undefined);}
  return {
    update(client:QueryClient,manifest:unknown,options:CalendarRangeOptions){
      if(!manifest){destroy();return;}
      const key=JSON.stringify(options.queryKey);
      if(observer&&currentClient===client&&currentKey===key){observer.setOptions(options);return;}
      destroy();currentClient=client;currentKey=key;
      observer=new QueryObserver(client,options);changed(observer);unsubscribe=observer.subscribe(apply);apply(observer.getCurrentResult());
    },
    refetch:async()=>observer?.refetch(),destroy,
  };
}
