import type { RequestEvent } from '@sveltejs/kit';
import * as v from 'valibot';
import { AuthFlowError, type IdentityContext } from './passkey-flow.ts';
import { requireSessionMutationOrigin, SessionOriginError } from './request.ts';

/** The runtime owner supplies these values from trusted operator configuration before authentication. */
export function requestIdentity(event: RequestEvent, mutation = false): IdentityContext {
  const runtime = (event.locals as App.Locals & { cmsRuntime?: Omit<IdentityContext, 'database'> }).cmsRuntime;
  if (!event.locals.cms?.database || !runtime) throw new AuthFlowError('NOT_CONFIGURED', 503);
  if (mutation) requireSessionMutationOrigin(event.request, runtime.publicOrigin);
  return { database: event.locals.cms.database, ...runtime };
}
export function identityCookiePath(context: IdentityContext) { return `${context.basePath}/`; }
export function identitySuccess<T>(data: T) {
  return Response.json({ success: true, data }, { headers: { 'cache-control': 'private, no-store' } });
}
export function identityFailure(code: string, message: string, status: number) {
  return Response.json({ success: false, error: { code, message } }, { status,
    headers: { 'cache-control': 'private, no-store', ...(status === 429 ? { 'retry-after': '60' } : {}) } });
}
export async function identityApi(event: RequestEvent, code: string, action: (context: IdentityContext) => Promise<Response>, mutation = true) {
  try { return await action(requestIdentity(event, mutation)); }
  catch (cause) {
    if (cause instanceof AuthFlowError) return identityFailure(cause.code, cause.message, cause.status);
    if (cause instanceof SessionOriginError) return identityFailure(cause.code, 'Cross-origin session mutation blocked', 403);
    return identityFailure(code, 'Authentication request failed', 500);
  }
}
export async function identityBody<T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(event: RequestEvent, schema: T, optional = false): Promise<v.InferOutput<T>> {
  const length = event.request.headers.get('Content-Length');
  if (length && parseInt(length, 10) > 10 * 1024 * 1024) throw new AuthFlowError('PAYLOAD_TOO_LARGE', 413);
  let text: string;
  try { text = await event.request.text(); }
  catch { if (optional) text = ''; else throw new AuthFlowError('INVALID_JSON'); }
  let input: unknown;
  try { input = optional && !text.trim() ? {} : JSON.parse(text); }
  catch { throw new AuthFlowError('INVALID_JSON'); }
  const parsed = v.safeParse(schema, input);
  if (!parsed.success) throw new AuthFlowError('VALIDATION_ERROR');
  return parsed.output;
}
