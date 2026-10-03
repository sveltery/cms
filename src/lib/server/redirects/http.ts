// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc.; notices/emdash-MIT.txt.
// Immutable Source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; whole authorities retained in parity.
// Bounded redirect-domain status mapping, not the full Source API registry.
import {InvalidCursorError} from "../database/lifecycle/upstream/database/repositories/types.ts";
import type {ApiResult} from "./api-types.ts";

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

function mapErrorStatus(code:string|undefined):number {
 if(code==='NOT_FOUND')return 404;
 if(code==='CONFLICT')return 409;
 return code?.endsWith('_ERROR')?500:400;
}
