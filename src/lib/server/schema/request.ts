import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { CmsError } from '../database/contract';
import { cmsService } from '../database/service';

/** Trusted locals only; permission denial precedes storage/configuration inspection. */
export function requestSchema(operation: 'read' | 'mutation' = 'read') {
  const context = getRequestEvent().locals.cms;
  const principal = context?.principal;
  if (!principal || typeof principal.id !== 'string' || !principal.id.length || principal.id.length > 128 ||
    !Array.isArray(principal.permissions)) throw new CmsError('UNAUTHENTICATED');
  const permission = operation === 'mutation' ? 'schema:manage' : 'schema:read';
  if (!principal.permissions.includes(permission)) throw new CmsError('FORBIDDEN');
  if (operation === 'mutation' && context?.mutationsEnabled !== true) {
    error(503, { message: 'Schema mutations are disabled', code: 'MUTATIONS_DISABLED' });
  }
  if (!context?.database) error(503, { message: 'Schema storage is not configured', code: 'NOT_CONFIGURED' });
  return cmsService(context.database, principal);
}

export async function schemaResponse<T>(run: () => Promise<T>): Promise<T> {
  try { return await run(); }
  catch (cause) {
    if (cause instanceof CmsError) {
      const status = cause.code === 'UNAUTHENTICATED' ? 401 : cause.code === 'FORBIDDEN' ? 403 :
        cause.code === 'NOT_FOUND' ? 404 : cause.code === 'VALIDATION_ERROR' ? 400 :
          cause.code === 'MIGRATION_REQUIRED' ? 503 : 409;
      const message = cause.code === 'UNAUTHENTICATED' ? 'unauthenticated' :
        cause.code === 'FORBIDDEN' ? 'forbidden' : cause.code === 'NOT_FOUND' ? 'not-found' : cause.code.toLowerCase().replaceAll('_', '-');
      error(status, { message, code: cause.code === 'FORBIDDEN' ? 'INSUFFICIENT_PERMISSIONS' : cause.code });
    }
    throw cause;
  }
}
