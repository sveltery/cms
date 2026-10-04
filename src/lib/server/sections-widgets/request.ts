import type { RequestEvent } from '@sveltejs/kit';
import { requireSessionMutationOrigin, SessionOriginError } from '../auth/request.ts';
import { requirePerm } from './api/authorize.ts';
import { apiError } from './api/error.ts';
import type { Database } from './database-types.ts';
import type { APIRoute } from './route-types.ts';
import { requireSectionWidgetStorage, SectionWidgetStorageUnavailable } from './readiness.ts';

/** The ordinary runtime owns principal, storage, mutation opt-in and public origin. */
export async function sectionWidgetRequest(event: RequestEvent, family: 'sections' | 'widgets', operation: 'read' | 'manage', route: APIRoute): Promise<Response> {
  const context = event.locals.cms;
  const denied = requirePerm(context?.principal, `${family}:${operation}`);
  if (denied) return denied;
  if (operation === 'manage' && context?.mutationsEnabled !== true) return apiError('MUTATIONS_DISABLED', 'Mutations are disabled', 503);
  if (!context?.database) return apiError('NOT_CONFIGURED', 'Storage is not configured', 503);
  if (operation === 'manage') {
    try { requireSessionMutationOrigin(event.request, event.locals.cmsRuntime?.publicOrigin ?? ''); }
    catch (cause) { if (cause instanceof SessionOriginError) return apiError('CSRF_REJECTED', 'Cross-origin mutation blocked', 403); throw cause; }
  }
  const db = context.database.db.withTables<{ [Name in keyof Database]: Database[Name] }>().$pickTables<keyof Database>();
  try { await requireSectionWidgetStorage(db, family); }
  catch (cause) {
    if (cause instanceof SectionWidgetStorageUnavailable) return apiError('MIGRATION_REQUIRED', `Complete ${family} storage is unavailable`, 503);
    return apiError('STORAGE_UNAVAILABLE', 'Storage readiness could not be verified', 503);
  }
  return route({ url: event.url, request: event.request, params: event.params,
    locals: { emdash: { db }, user: context.principal } });
}
