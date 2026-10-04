// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; complete Source runtime bodies, imports adapted.
// Whole selected ApiResult declaration; originating complete types.ts authority retained.
/**
 * Discriminated union for handler results.
 *
 * Handlers return `ApiResult<T>` -- either `{ success: true, data: T }` or
 * `{ success: false, error: { code, message } }`. The `success` literal
 * enables TypeScript narrowing on `.data`.
 *
 * The generic `E` parameter defaults to `ErrorCode` but can be narrowed to
 * `OAuthErrorCode` for OAuth token-endpoint handlers.
 *
 * Use `unwrapResult()` from `error.ts` to convert to an HTTP Response.
 */
export type ApiResult<T, E extends string = string> =
	| { success: true; data: T }
	| {
			success: false;
			error: { code: E; message: string; details?: Record<string, unknown> };
	  };
