import type { Permission, ServerPrincipal } from '../../database/service.ts';
import { apiError } from './error.ts';
/** Current effective principal from trusted request composition; source thresholds own projection. */
export function requirePerm(user: ServerPrincipal | null | undefined, permission: Permission): Response | null {
  if (!user) return apiError('UNAUTHORIZED', 'Authentication required', 401);
  if (!user.permissions.includes(permission)) return apiError('FORBIDDEN', 'Insufficient permissions', 403);
  return null;
}
