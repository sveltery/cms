// Exact pinned Source SchemaError declaration with erasable parameter properties.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
export class SchemaError extends Error {
	public code: string;
	public details?: Record<string, unknown>;
	constructor(
		message: string,
		code: string,
		details?: Record<string, unknown>,
	) {
		super(message);
		this.code = code;
		this.details = details;
		this.name = "SchemaError";
	}
}
