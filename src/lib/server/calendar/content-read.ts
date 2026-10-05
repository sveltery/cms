import type { lifecycleService } from '../database/lifecycle/service.ts';
import { resolveConfiguredLocale } from '../menus/i18n-config.ts';

/** Calendar's trusted detail producer; the lifecycle retains read permission and storage ownership. */
export function readCalendarContent(service:Pick<ReturnType<typeof lifecycleService>,'getContent'>,collection:string|undefined,id:string|undefined,locale?:string){
  // Pinned handleContentGet resolves a slug in the supplied site locale, while
  // ID lookup infers the stored locale even when the request omits it.
  return service.getContent({type:collection,id,...(locale?{locale:resolveConfiguredLocale(locale)}:{})},{inferLocale:true,resolveIdentifier:true});
}
