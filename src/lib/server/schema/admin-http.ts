import { json, type RequestEvent } from '@sveltejs/kit';
import { cmsService } from '../database/service';
import { CmsError } from '../database/contract';
import { requireSessionMutationOrigin, SessionOriginError } from '../auth/request';

/** Only the existing trusted composition can supply identity and storage. */
export async function schemaAdminHttp(event: Pick<RequestEvent, 'request' | 'locals'>, mutation: boolean,
  run: (service: ReturnType<typeof cmsService>) => Promise<Record<string, unknown>>) {
  const configuration = event.locals.cms, principal = configuration?.principal;
  if (!principal) return failure('UNAUTHENTICATED', 'Authentication required', 401);
  if (!principal.permissions.includes(mutation ? 'schema:manage' : 'schema:read')) return failure('FORBIDDEN', 'Insufficient permissions', 403);
  if (mutation) {
    if (configuration?.mutationsEnabled !== true) return failure('MUTATIONS_DISABLED', 'Schema mutations are disabled', 503);
    try { requireSessionMutationOrigin(event.request, event.locals.cmsRuntime?.publicOrigin ?? ''); }
    catch (cause) { if (cause instanceof SessionOriginError) return failure(cause.code, cause.message, 403); throw cause; }
  }
  if (!configuration?.database) return failure('NOT_CONFIGURED', 'Schema storage is not configured', 503);
  try { return json({ success: true, data: await run(cmsService(configuration.database, principal)) }); }
  catch (cause) {
    if (cause instanceof CmsError) return failure(cause.code, cause.code.toLowerCase().replaceAll('_','-'),
      cause.code === 'NOT_FOUND' ? 404 : cause.code === 'FORBIDDEN' ? 403 : cause.code === 'VALIDATION_ERROR' ? 400 : cause.code === 'MIGRATION_REQUIRED' ? 503 : 409);
    if (cause instanceof SyntaxError) return failure('VALIDATION_ERROR', 'Invalid JSON request', 400);
    return failure('SCHEMA_ERROR', 'Schema request failed', 500);
  }
}
function failure(code: string, message: string, status: number) { return json({ success: false, error: { code, message } }, { status }); }
