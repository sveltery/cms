import type { lifecycleService } from '../database/lifecycle/service.ts';

/** Calendar's trusted detail producer; the lifecycle retains read permission and storage ownership. */
export function readCalendarContent(service:Pick<ReturnType<typeof lifecycleService>,'getContent'>,collection:string|undefined,id:string|undefined,locale?:string,translations=false){
  return service.getContent({type:collection,id,...(locale?{locale}:{})},{inferLocale:translations});
}
