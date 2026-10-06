// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/schema/registry.ts; complete SchemaError declaration.
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
