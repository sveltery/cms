// Extraction of actual Native range observer scope; pin913cb1bb/MIT.
// The app-supplied QueryClient remains the sole owner and cache.
import {QueryObserver,type QueryClient,type QueryObserverOptions} from '@tanstack/react-query';
import type {CalendarRange} from './api.ts';
export type CalendarRangeOptions=QueryObserverOptions<CalendarRange,Error,CalendarRange,CalendarRange,readonly ['calendar',string,string]>;
export type CalendarRangeObserver=QueryObserver<CalendarRange,Error,CalendarRange,CalendarRange,readonly ['calendar',string,string]>;
export function createCalendarRangeOwner(apply:(result:ReturnType<CalendarRangeObserver['getCurrentResult']>)=>void,changed:(observer:CalendarRangeObserver|undefined)=>void){
  let observer:CalendarRangeObserver|undefined,unsubscribe=()=>{};
  function destroy(){unsubscribe();observer?.destroy();observer=undefined;changed(undefined);}
  return {
    update(client:QueryClient,manifest:unknown,options:CalendarRangeOptions){
      destroy();if(!manifest)return;
      observer=new QueryObserver(client,options);changed(observer);unsubscribe=observer.subscribe(apply);apply(observer.getCurrentResult());
    },
    refetch:async()=>observer?.refetch(),destroy,
  };
}
