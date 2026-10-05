// Native SSR snapshot extraction. The existing page QueryClient is the sole owner.
import type {QueryClient} from '@tanstack/react-query';
import type {CalendarManifest,CalendarUser} from './ui-types.ts';
export interface CalendarMetadata {manifest:CalendarManifest|undefined;user:CalendarUser|null|undefined}
export interface CalendarMetadataReaders {
  fetchManifest:()=>Promise<CalendarManifest>;fetchCurrentUser:()=>Promise<CalendarUser|null>;
}
export function observeCalendarMetadata(_client:QueryClient,_readers:CalendarMetadataReaders,initial:CalendarMetadata,apply:(value:CalendarMetadata)=>void){
  apply(initial);
  return {refetchManifest:async()=>initial.manifest,refetchUser:async()=>initial.user,destroy(){}};
}
