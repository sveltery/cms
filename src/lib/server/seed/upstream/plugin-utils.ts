// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Complete named Source isRecord declaration.
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
