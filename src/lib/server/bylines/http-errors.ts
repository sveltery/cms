// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Whole route bodies with native context/imports; optional configured hook seam.
/**
 * Standardized API error responses.
 *
 * All API routes should use these utilities instead of inline
 * `new Response(JSON.stringify({ error: ... }), ...)` patterns.
 */

import { InvalidCursorError } from "./repository-types.ts";
// Exact finite Source status cases reachable by the byline producer.
function mapErrorStatus(code:string):number {
 if(['VALIDATION_ERROR','INVALID_INPUT','INVALID_JSON','INVALID_CURSOR','MISSING_PARAM','INVALID_REQUEST','NOT_SUPPORTED','INVALID_SLUG','RESERVED_SLUG','INVALID_TYPE','AMBIGUOUS_LOCALE','REORDER_MISMATCH'].includes(code))return 400;
 if(['UNAUTHORIZED','NOT_AUTHENTICATED'].includes(code))return 401;
 if(code==='FORBIDDEN')return 403;
 if(['NOT_FOUND','TABLE_NOT_FOUND','COLLECTION_NOT_FOUND'].includes(code))return 404;
 if(['CONFLICT','SLUG_CONFLICT','FIELD_EXISTS','TRANSLATABLE_LOCKED'].includes(code))return 409;
 return 500;
}
import type { ApiResult } from "./api-types.ts";

// Re-export everything from errors.ts so existing `import { mapErrorStatus } from "./error.js"` still works


/**
 * Standard cache headers for all API responses.
 *
 * Cache-Control: private, no-store -- prevents CDN/proxy caching of authenticated data.
 * no-store already tells caches not to store the response, so Vary is unnecessary.
 */
const API_CACHE_HEADERS: HeadersInit = {
	"Cache-Control": "private, no-store",
};

/**
 * Create a standardized error response.
 *
 * Always returns `{ success: false, error: { code, message } }` with correct
 * Content-Type. Use this for all error responses in API routes.
 */
export function apiError(
	code: string,
	message: string,
	status: number,
	details?: Record<string, unknown>,
): Response {
	const error: { code: string; message: string; details?: Record<string, unknown> } = {
		code,
		message,
	};
	if (details !== undefined) error.details = details;
	return Response.json({ success: false, error }, { status, headers: API_CACHE_HEADERS });
}

/**
 * Create a standardized success response.
 *
 * Always returns `{ success: true, data: T }` with correct status code.
 * Use this for all success responses in API routes.
 */
export function apiSuccess<T>(data: T, status = 200): Response {
	return Response.json({ success: true, data }, { status, headers: API_CACHE_HEADERS });
}

/**
 * Handle an unknown error in a catch block.
 *
 * - Logs the full error server-side
 * - Returns a generic message to the client (never leaks error.message)
 * - Use `fallbackMessage` for the public-facing message
 * - Use `fallbackCode` for the error code
 */
export function handleError(
	error: unknown,
	fallbackMessage: string,
	fallbackCode: string,
): Response {
	// Bubble malformed-cursor errors as a structured 400 instead of a
	// generic 500.
	if (error instanceof InvalidCursorError) {
		return apiError("INVALID_CURSOR", error.message, 400);
	}
	console.error(`[${fallbackCode}]`, error);
	return apiError(fallbackCode, fallbackMessage, 500);
}

/**
 * Standard initialization check.
 *
 * Returns an error response if EmDash is not initialized, or null if OK.
 * Usage: `const err = requireInit(emdash); if (err) return err;`
 */
export function requireInit(emdash: unknown): Response | null {
	if (!emdash || typeof emdash !== "object") {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}
	return null;
}

/**
 * Standard database check.
 *
 * Returns an error response if the database is not available, or null if OK.
 * Usage: `const err = requireDb(emdash?.db); if (err) return err;`
 */
export function requireDb(db: unknown): Response | null {
	if (!db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}
	return null;
}

/**
 * Convert an ApiResult into an HTTP Response.
 *
 * Collapses the handler-to-response boilerplate:
 * - Success: returns `apiSuccess(result.data, successStatus)`
 * - Error: returns `apiError(code, message, mapErrorStatus(code))`
 */
export function unwrapResult<T>(result: ApiResult<T>, successStatus = 200): Response {
	if (!result.success) {
		return apiError(
			result.error.code,
			result.error.message,
			mapErrorStatus(result.error.code),
			result.error.details,
		);
	}
	return apiSuccess(result.data, successStatus);
}
