// CALUI-TRANSPORT01 native trusted transport. EmDash1.1.0 pin913cb1bb,
// MIT notices/emdash-MIT.txt. No database opened, migrated or written here:
// existing lifecycle methods retain the only publication/scheduling writer.
import type { RequestEvent } from '@sveltejs/kit';
import { CmsError } from '../database/contract.ts';
import { lifecycleService } from '../database/lifecycle/service.ts';
import { editorManifest } from '../content/manifest.ts';
import { currentUser } from '../auth/current-user.ts';
import { requireSessionMutationOrigin,SessionOriginError } from '../auth/request.ts';
import { apiError,apiSuccess } from '../sections-widgets/api/error.ts';
import { withRevision,precondition } from '../content/schema.ts';
import { contentEntry } from '../lifecycle/schema.ts';
import { parse } from '../database/validation.ts';
import { canonicalSourceDatabase } from '../canonical-storage/namespace.ts';
import { OptionsRepository } from '../options/repository.ts';
import { getI18nConfig } from '../menus/i18n-config.ts';
import { readCalendarContent } from './content-read.ts';
import { calendarMutation } from './mutation.ts';
type Event=Pick<RequestEvent,'request'|'url'|'params'|'locals'>;
function failure(cause:unknown):Response {
  if(cause instanceof CmsError){
    const status=cause.code==='UNAUTHENTICATED'?401:cause.code==='FORBIDDEN'?403:cause.code==='NOT_FOUND'?404:cause.code==='VALIDATION_ERROR'?400:cause.code==='MIGRATION_REQUIRED'?503:409;
    return apiError(cause.code,cause.message,status);
  }
  return apiError('CALENDAR_ERROR','Could not update the calendar',500);
}
function context(event:Event,mutation=false){
  const cms=event.locals.cms;
  if(!cms?.principal)throw new CmsError('UNAUTHENTICATED');
  if(!cms.database)throw new CmsError('MIGRATION_REQUIRED');
  if(mutation){
    if(cms.mutationsEnabled!==true)return apiError('MUTATIONS_DISABLED','Mutations are disabled',503);
    requireSessionMutationOrigin(event.request,event.locals.cmsRuntime?.publicOrigin??'');
  }
  return cms;
}
export async function calendarManifestGet(event:Event):Promise<Response>{
  try{
    const cms=context(event);if(cms instanceof Response)return cms;
    const manifest=await editorManifest(cms.database,cms.principal);
    const options=new OptionsRepository(canonicalSourceDatabase(cms.database));
    const timezone=await options.get<string>('site:timezone');
    return apiSuccess({...manifest,timezone:timezone??'UTC',i18n:getI18nConfig()??undefined});
  }catch(cause){return failure(cause);}
}
export async function calendarUserGet(event:RequestEvent):Promise<Response>{
  try{const cms=context(event);if(cms instanceof Response)return cms;return apiSuccess(await currentUser(event));}catch(cause){return failure(cause);}
}
export async function calendarContentGet(event:Event):Promise<Response>{
  try{
    const cms=context(event);if(cms instanceof Response)return cms;
    const locale=event.url.searchParams.get('locale')??undefined;
    const service=lifecycleService(cms.database,cms.principal);
    const translations=event.url.searchParams.get('view')==='translations';
    const item=await readCalendarContent(service,event.params.collection,event.params.id,locale,translations);
    if(translations){
      const {ContentRepository}=await import('../database/lifecycle/upstream/database/repositories/content.ts');
      const siblings=item.translationGroup?await new ContentRepository(cms.database.db as any).findTranslations(item.type,item.translationGroup):[];
      return apiSuccess({translationGroup:item.translationGroup,translations:siblings.map(({id,locale,status})=>({id,locale,status}))});
    }
    // Consume only the published byline read producer, never synthesize credits.
    const {BylineRepository}=await import('../bylines/repository.ts');
    const bylines=await new BylineRepository(cms.database).getContentBylines(item.type,item.id,{locale:item.locale??undefined});
    return apiSuccess({...withRevision(contentEntry(item)),bylines});
  }catch(cause){return failure(cause);}
}
export async function calendarContentPost(event:Event):Promise<Response>{
  try{
    const cms=context(event,true);if(cms instanceof Response)return cms;
    const text=await event.request.text();if(text.length>8192)return apiError('VALIDATION_ERROR','Request is too large',400);
    let raw:unknown;try{raw=JSON.parse(text);}catch{return apiError('VALIDATION_ERROR','Invalid JSON',400);}
    const value=parse(calendarMutation,raw);
    const key={collection:event.params.collection!,id:event.params.id!,locale:event.url.searchParams.get('locale')??'en'};
    const input={type:key.collection,id:key.id,locale:key.locale,...(value._rev===undefined?{}:{expected:precondition({...key,_rev:value._rev})})};
    const keepAlive=cms.keepAlive;
    const service=lifecycleService(cms.database,cms.principal,keepAlive?{after:task=>keepAlive(Promise.resolve().then(task))}:{});
    const item=value.action==='publish'?await service.publish(input):value.action==='schedule'?await service.schedule({...input,scheduledAt:value.scheduledAt}):await service.unschedule(input);
    return apiSuccess(withRevision(contentEntry(item)));
  }catch(cause){if(cause instanceof SessionOriginError)return apiError(cause.code,cause.message,403);return failure(cause);}
}
