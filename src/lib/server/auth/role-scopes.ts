// Pure scope data/types from EmDash 1.1.0; token generation/issuance is unfinished.
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/auth/src/tokens.ts
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
export const TRANSFER_SCOPES = ["transfer:export", "transfer:analyze", "transfer:execute"] as const;

export const VALID_SCOPES = [
	"content:read",
	"content:write",
	"media:read",
	"media:write",
	"schema:read",
	"schema:write",
	"taxonomies:manage",
	"menus:manage",
	"settings:read",
	"settings:manage",
	"mcp:tools",
	...TRANSFER_SCOPES,
	"admin",
] as const;

export type ApiTokenScope = (typeof VALID_SCOPES)[number] | `mcp:tools:${string}`;
