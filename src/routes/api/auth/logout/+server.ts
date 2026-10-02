import type { RequestHandler } from './$types';
import { identityApi, identityCookiePath, identitySuccess } from '$lib/server/auth/identity-request';
import { revokeSession } from '$lib/server/auth/session';
import { createKyselySessionStore } from '$lib/server/auth/store';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_DELETE_OPTIONS } from '$lib/server/auth/request';

export const POST: RequestHandler = event => identityApi(event, 'LOGOUT_ERROR', async context => {
  await revokeSession(event.cookies.get(SESSION_COOKIE_NAME), createKyselySessionStore(context.database.db));
  event.cookies.delete(SESSION_COOKIE_NAME, { ...SESSION_COOKIE_DELETE_OPTIONS, path: identityCookiePath(context) });
  return identitySuccess({ success: true });
});
