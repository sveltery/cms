import type { RequestHandler } from './$types';
import { beginAdminSetup, SETUP_NONCE_COOKIE, SETUP_NONCE_MAX_AGE_SECONDS } from '$lib/server/auth/passkey-flow';
import { identityApi, identityBody, identityCookiePath, identitySuccess } from '$lib/server/auth/identity-request';
import { setupAdminInput } from '$lib/server/auth/identity-schemas';

export const POST: RequestHandler = event => identityApi(event, 'SETUP_ADMIN_ERROR', async context => {
  const result = await beginAdminSetup(context, () => identityBody(event, setupAdminInput));
  event.cookies.set(SETUP_NONCE_COOKIE, result.nonce, { path: identityCookiePath(context), httpOnly: true,
    sameSite: 'strict', secure: new URL(context.publicOrigin).protocol === 'https:', maxAge: SETUP_NONCE_MAX_AGE_SECONDS });
  return identitySuccess({ success: true, options: result.options });
});
