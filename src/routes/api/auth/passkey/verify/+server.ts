import type { RequestHandler } from './$types';
import { authenticatePasskey, issueSession, SESSION_MAX_AGE_SECONDS } from '$lib/server/auth/passkey-flow';
import { identityApi, identityBody, identityCookiePath, identityFailure, identitySuccess } from '$lib/server/auth/identity-request';
import { loginVerifyInput } from '$lib/server/auth/identity-schemas';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '$lib/server/auth/request';
import { PasskeyAuthenticationError } from '$lib/server/auth/vendor/passkey/authenticate';

export const POST: RequestHandler = event => identityApi(event, 'PASSKEY_VERIFY_ERROR', async context => {
  const input = await identityBody(event, loginVerifyInput);
  try {
    const user = await authenticatePasskey(context, input.credential);
    const session = await issueSession(context, user, event.cookies.get(SESSION_COOKIE_NAME));
    event.cookies.set(SESSION_COOKIE_NAME, session.token, { ...SESSION_COOKIE_OPTIONS,
      path: identityCookiePath(context), maxAge: SESSION_MAX_AGE_SECONDS, expires: new Date(session.expiresAt) });
    return identitySuccess({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (cause) {
    if (cause instanceof PasskeyAuthenticationError) return identityFailure('UNAUTHORIZED', 'Authentication failed', 401);
    throw cause;
  }
});
