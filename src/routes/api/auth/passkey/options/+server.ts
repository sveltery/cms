import type { RequestHandler } from './$types';
import { authenticationOptions } from '$lib/server/auth/passkey-flow';
import { identityApi, identityBody, identitySuccess } from '$lib/server/auth/identity-request';
import { loginOptionsInput } from '$lib/server/auth/identity-schemas';

export const POST: RequestHandler = event => identityApi(event, 'PASSKEY_OPTIONS_ERROR', async context => {
  await identityBody(event, loginOptionsInput, true);
  const options = await authenticationOptions(context, event.getClientAddress());
  return identitySuccess({ success: true, options });
});
