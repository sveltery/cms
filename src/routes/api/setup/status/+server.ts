import type { RequestHandler } from './$types';
import { runtimeSetupStatus } from '$lib/server/setup/status';
import { identityApi, identitySuccess } from '$lib/server/auth/identity-request';

export const GET: RequestHandler = event => identityApi(event, 'SETUP_STATUS_ERROR', async context => {
  return identitySuccess(await runtimeSetupStatus(context));
}, false);
