// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc.; see notices/emdash-MIT.txt.
// Source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/database/types.ts; blob cdbabe910a87d12eab47933b8f5fb16ff6db3aa7.
import type { Generated } from "kysely";

export interface RedirectTable {
	id: string;
	source: string;
	destination: string;
	type: number; // 301, 302, 307, 308
	is_pattern: number; // boolean: source contains [param] or [...splat]
	enabled: number; // boolean
	hits: number;
	last_hit_at: string | null;
	group_name: string | null;
	auto: number; // boolean: system-generated from slug change
	config_revision: string;
	source_guard: number;
	write_generation: number;
	created_at: string;
	updated_at: string;
}

export interface RedirectWriteLockTable {
	id: number;
	token: string;
	expires_at: number;
	generation: number;
}

export interface RedirectStateTable {
	id: number;
	revision: Generated<number>;
	generation: string | null;
	generation_revision: Generated<number>;
	repair_expires_at: Generated<number>;
}

export interface RedirectArtifactTable {
	digest: string;
	kind: string;
	payload: string;
}

export interface RedirectGenerationArtifactTable {
	generation: string;
	position: number;
	digest: string;
}

export interface NotFoundLogTable {
	id: string;
	path: string;
	referrer: string | null;
	user_agent: string | null;
	ip: string | null;
	hits: number;
	/**
	 * Migration 035 adds this as a nullable column (SQLite can't add a
	 * NOT NULL column with a non-constant default to an existing table).
	 * The `log404` upsert always writes a value, so new and updated rows
	 * always have one, but existing rows pre-migration were backfilled
	 * without a NOT NULL constraint. Typed as nullable to match the schema.
	 */
	last_seen_at: string | null;
	created_at: string;
}


export interface OptionTable {
	name: string;
	value: string; // JSON
	revision: Generated<string>;
}

export interface Database {
 options: OptionTable;
 _cms_redirects: RedirectTable;
 _cms_redirect_write_lock: RedirectWriteLockTable;
 _cms_redirect_state: RedirectStateTable;
 _cms_redirect_artifacts: RedirectArtifactTable;
 _cms_redirect_generation_artifacts: RedirectGenerationArtifactTable;
 _cms_404_log: NotFoundLogTable;
}
