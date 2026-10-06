import type { RequestHandler } from './$types';
import { identityApi, identityFailure } from '$lib/server/auth/identity-request';
import { setupStatus } from '$lib/server/auth/passkey-flow';
import { applySetupSite } from '$lib/server/setup/site';

export const POST: RequestHandler = event => identityApi(event, 'SETUP_ERROR', async context => {
  const account = await setupStatus(context);
  if (account.unavailable) return identityFailure('LEGACY_IDENTITY_UNAVAILABLE', 'Authentication request failed', 503);
  if (!account.needsSetup) return identityFailure('ALREADY_CONFIGURED', 'Setup has already been completed', 409);
  return applySetupSite({ database: context.database, request: event.request, url: event.url,
    configuredOrigin: context.publicOrigin, development: import.meta.env.DEV,
    workers: typeof navigator !== 'undefined' && navigator.userAgent.includes('Cloudflare-Workers'),
    storage: event.locals.cms?.storage });
});
