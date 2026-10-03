import type { RequestEvent } from '@sveltejs/kit';
import type { Kysely } from 'kysely';
import { requireSessionMutationOrigin, SessionOriginError } from '../auth/request.ts';
import { apiError } from './http-errors.ts';
import { menuStorageReady } from './readiness.ts';
import { runWithContext } from './context.ts';
import type { Database } from './database-types.ts';

/** Consume the existing trusted request composition. Never open or migrate DBs. */
export async function withMenuRequest(
  event: Pick<RequestEvent, 'request' | 'url' | 'locals'>,
  mutation: boolean,
  errorCode: string,
  errorMessage: string,
  run: (db: Kysely<Database>) => Promise<Response>
): Promise<Response> {
  const configuration = event.locals.cms;
  if (!configuration) return apiError('NOT_CONFIGURED', 'Menus are not configured', 503);
  const principal = configuration.principal;
  if (!principal) return apiError('UNAUTHORIZED', 'Authentication required', 401);
  if (!principal.permissions.includes(mutation ? 'menus:manage' : 'menus:read')) return apiError('FORBIDDEN', 'Insufficient permissions', 403);
  if (mutation) {
    if (configuration.mutationsEnabled !== true) return apiError('MUTATIONS_DISABLED', 'Mutations are disabled', 503);
    try { requireSessionMutationOrigin(event.request, event.locals.cmsRuntime?.publicOrigin ?? ''); }
    catch (error) {
      if (error instanceof SessionOriginError) return apiError(error.code, error.message, 403);
      throw error;
    }
  }
  if (!await menuStorageReady(configuration.database)) return apiError('MIGRATION_REQUIRED', 'Menu storage is not ready', 503);
  const db = configuration.database.db.withTables<{[Name in keyof Database]: Database[Name]}>().$pickTables<keyof Database>();
  try {
    return await runWithContext({ db, locale: event.url.searchParams.get('locale') ?? undefined, editMode: false,
      keepAlive: configuration.keepAlive }, () => run(db));
  } catch (error) {
    console.error(`[${errorCode}]`, error);
    return apiError(errorCode, errorMessage, 500);
  }
}
