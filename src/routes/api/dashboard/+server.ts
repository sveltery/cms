// Native SvelteKit transport of complete pinned Source dashboard stats.
// EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright2026CloudflareInc. MIT.
import type { RequestHandler } from './$types';
import { identityFailure } from '$lib/server/auth/identity-request';
import { unwrapResult } from '$lib/server/menus/http-errors';
import { handleDashboardStats } from '$lib/server/setup/dashboard/handler';
import { dashboardSourceDatabase } from '$lib/server/setup/dashboard/namespace';

export const GET: RequestHandler = async event => {
  const principal = event.locals.cms?.principal;
  if (!principal) return identityFailure('UNAUTHORIZED', 'Authentication required', 401);
  if (!principal.permissions.includes('content:read'))
    return identityFailure('FORBIDDEN', 'Insufficient permissions', 403);
  const storage = event.locals.cms?.database;
  if (!storage) return identityFailure('NOT_CONFIGURED', 'Dashboard is not configured', 503);
  return unwrapResult(await handleDashboardStats(dashboardSourceDatabase(storage)));
};
