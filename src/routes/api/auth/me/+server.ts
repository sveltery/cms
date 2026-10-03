import type { RequestHandler } from './$types';
import { currentUser } from '$lib/server/auth/current-user';
import { identityFailure, identitySuccess } from '$lib/server/auth/identity-request';

export const GET: RequestHandler = async event => {
  try {
    const user = await currentUser(event);
    return user ? identitySuccess(user) : identityFailure('NOT_AUTHENTICATED', 'Not authenticated', 401);
  } catch { return identityFailure('CURRENT_USER_ERROR', 'Failed to fetch current user', 500); }
};
