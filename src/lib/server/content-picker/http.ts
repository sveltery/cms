import type { RequestEvent } from '@sveltejs/kit';
import { CmsError } from '../database/contract.ts';
import { EmDashValidationError, ContentCollectionNotFoundError, InvalidCursorError } from '../database/lifecycle/upstream/database/repositories/types.ts';
import { contentPickerService } from './service.ts';

const headers = { 'cache-control': 'private, no-store' };
function failed(code: string, message: string, status: number) { return Response.json({ success: false, error: { code, message } }, { status, headers }); }
/** Consume current trusted locals only. This read boundary never opens or migrates storage. */
export async function withContentPickerRequest(event: Pick<RequestEvent, 'locals'>,
  run: (service: ReturnType<typeof contentPickerService>) => Promise<unknown>) {
  const context = event.locals.cms;
  if (!context?.database) return failed('NOT_CONFIGURED', 'Content storage is not configured', 503);
  try {
    return Response.json({ success: true, data: await run(contentPickerService(context.database, context.principal)) }, { headers });
  } catch (error) {
    if (error instanceof CmsError) {
      if (error.code === 'UNAUTHENTICATED') return failed('UNAUTHORIZED', 'Authentication required', 401);
      if (error.code === 'FORBIDDEN') return failed('FORBIDDEN', 'Insufficient permissions', 403);
      if (error.code === 'NOT_FOUND') return failed('COLLECTION_NOT_FOUND', 'Collection not found', 404);
      if (error.code === 'VALIDATION_ERROR') return failed('VALIDATION_ERROR', 'Invalid query parameters', 400);
    }
    if (error instanceof ContentCollectionNotFoundError) return failed('COLLECTION_NOT_FOUND', error.message, 404);
    if (error instanceof InvalidCursorError) return failed('INVALID_CURSOR', error.message, 400);
    if (error instanceof EmDashValidationError) return failed('VALIDATION_ERROR', error.message, 400);
    console.error('[content-picker]', error);
    return failed('CONTENT_LIST_ERROR', 'Failed to list content', 500);
  }
}
