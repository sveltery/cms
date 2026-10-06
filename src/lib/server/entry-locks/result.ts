// Complete Source ApiResult type; MIT Copyright 2026 Cloudflare Inc.
export type ApiResult<T, E extends string = string> =
	| { success: true; data: T }
	| {
			success: false;
			error: { code: E; message: string; details?: Record<string, unknown> };
	  };
