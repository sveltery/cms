import type { RequestHandler } from './$types';
import { currentUser } from '$lib/server/auth/current-user';
import * as v from 'valibot';
import { identityApi, identityBody, identityFailure, identitySuccess } from '$lib/server/auth/identity-request';
import { identityAdapter } from '$lib/server/auth/identity-store';
import { persistWelcomeDismissed } from '$lib/server/setup/welcome';

export const GET: RequestHandler = async event => {
  try {
    const user = await currentUser(event);
    return user ? identitySuccess(user) : identityFailure('NOT_AUTHENTICATED', 'Not authenticated', 401);
  } catch { return identityFailure('CURRENT_USER_ERROR', 'Failed to fetch current user', 500); }
};

// EmDash 1.1.0 MIT, pin913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:
// packages/core/src/astro/routes/api/auth/me.ts POST; native transport/storage seams documented.
const actionBody = v.object({ action: v.pipe(v.string(), v.minLength(1)) });
export const POST: RequestHandler = async event => {
  const principal = event.locals.cms?.principal;
  if (!principal) return identityFailure('NOT_AUTHENTICATED', 'Not authenticated', 401);
  return identityApi(event, 'WELCOME_DISMISS_ERROR', async context => {
    const user = await identityAdapter(context.database).getUserById(principal.id);
    if (!user) return identityFailure('NOT_AUTHENTICATED', 'Not authenticated', 401);
    const body = await identityBody(event, actionBody);
    if (body.action !== 'dismissWelcome')
      return identityFailure('UNKNOWN_ACTION', 'Unknown action', 400);
    try {
      await persistWelcomeDismissed(context.database, user);
      return identitySuccess({ success: true });
    } catch {
      return identityFailure('WELCOME_DISMISS_ERROR', 'Failed to dismiss welcome', 500);
    }
  });
};
