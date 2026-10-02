import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { InvalidCursorError } from '../database/trash-cursor';
import { CmsError } from '../database/contract';
import { cmsService } from '../database/service';

/** The adapter/session owner supplies trusted request locals. No database is opened here. */
export function requestContent(operation: 'read' | 'mutation' = 'read') {
  const context = getRequestEvent().locals.cms;
  if (!context?.principal) throw new CmsError('UNAUTHENTICATED');
  if (operation === 'mutation' && context.mutationsEnabled !== true) error(503, { message: 'Content mutations are disabled', code: 'MUTATIONS_DISABLED' });
  if (!context.database) error(503, { message: 'Content storage is not configured', code: 'NOT_CONFIGURED' });
  return cmsService(context.database, context.principal);
}

export async function contentResponse<T>(run: () => Promise<T>): Promise<T> {
  try { return await run(); }
  catch (cause) {
    if (cause instanceof InvalidCursorError) error(400, { message: 'invalid-cursor', code: 'INVALID_CURSOR' });
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
