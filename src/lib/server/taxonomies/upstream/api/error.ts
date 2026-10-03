// EmDash pinned913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; cac556e93bb76d42e7a36353cd045ce22638f3ef
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt. Explicit native module seams.
/**
 * Standardized API error responses.
 *
 * All API routes should use these utilities instead of inline
 * `new Response(JSON.stringify({ error: ... }), ...)` patterns.
 */

import { InvalidCursorError } from "../database/repositories/types.ts";
import { mapErrorStatus } from "./errors.ts";
import type { ApiResult } from "./types.ts";

// Re-export everything from errors.ts so existing `import { mapErrorStatus } from "./error.ts"` still works
export * from "./errors.ts";

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
