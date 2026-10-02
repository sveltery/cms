import type { RequestHandler } from './$types';
import { finishAdminSetup, SETUP_NONCE_COOKIE } from '$lib/server/auth/passkey-flow';
import { identityApi, identityBody, identityCookiePath, identitySuccess } from '$lib/server/auth/identity-request';
import { setupVerifyInput } from '$lib/server/auth/identity-schemas';

export const POST: RequestHandler = event => identityApi(event, 'SETUP_VERIFY_ERROR', async context => {
  const input = await identityBody(event, setupVerifyInput);
  const user = await finishAdminSetup(context, event.cookies.get(SETUP_NONCE_COOKIE), input.credential);
  event.cookies.delete(SETUP_NONCE_COOKIE, { path: identityCookiePath(context) });
  return identitySuccess({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});
