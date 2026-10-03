// Source api/error.ts menu response primitives and api/errors.ts relevant cases.
// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import type { ApiResult } from './api-types.ts';
const headers = { 'Cache-Control': 'private, no-store' };
export function apiError(code: string, message: string, status: number, details?: Record<string, unknown>): Response {
  return Response.json({ success: false, error: { code, message, ...(details !== undefined ? { details } : {}) } }, { status, headers });
}
export function unwrapResult<T>(result: ApiResult<T>, successStatus = 200): Response {
  if (result.success) return Response.json(result, { status: successStatus, headers });
  const code = result.error.code;
  const status = code === 'NOT_FOUND' ? 404 : code === 'CONFLICT' ? 409
    : ['VALIDATION_ERROR', 'AMBIGUOUS_LOCALE'].includes(code) ? 400 : code.endsWith('_ERROR') ? 500 : 400;
  return apiError(code, result.error.message, status, result.error.details);
}
