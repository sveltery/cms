import type { RequestHandler } from './$types';
import { setupStatus } from '$lib/server/auth/passkey-flow';
import { identityApi, identitySuccess } from '$lib/server/auth/identity-request';
import { setupSeedInfo } from '$lib/server/seed/info';

export const GET: RequestHandler = event => identityApi(event, 'SETUP_STATUS_ERROR', async context => {
  const status = await setupStatus(context);
  return identitySuccess(status.needsSetup ? { ...status, seedInfo: await setupSeedInfo() } : status);
}, false);
