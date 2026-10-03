import type { RequestHandler } from './$types';
import { setupStatus } from '$lib/server/auth/passkey-flow';
import { identityApi, identitySuccess } from '$lib/server/auth/identity-request';

export const GET: RequestHandler = event => identityApi(event, 'SETUP_STATUS_ERROR', async context => identitySuccess(await setupStatus(context)), false);
