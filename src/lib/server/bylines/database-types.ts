// EmDash 1.1.0, immutable 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc.; MIT; notices/emdash-MIT.txt.
// Complete Source bodies with native imports/storage hosting; docs/byline-backend.md.
import type {Generated} from "kysely";
export interface BylineTable {
	id: string;
	slug: string;
	display_name: string;
	bio: string | null;
	avatar_media_id: string | null;
	website_url: string | null;
	user_id: string | null;
	is_guest: number;
	created_at: Generated<string>;
	updated_at: Generated<string>;
	/**
	 * Locale this byline row is presented in. Added by migration 040. Backfilled
	 * to the configured `defaultLocale` for pre-040 rows. `(slug, locale)` is
	 * unique; the partial unique on `user_id` widens to `(user_id, locale)`.
	 */
	locale: Generated<string>;
	/**
	 * Shared across translations of the same byline. Added by migration 040.
	 * Equals `id` for the anchor row; siblings inherit it from their source.
	 * `_emdash_content_bylines.byline_id` and `ec_*.primary_byline_id` store
	 * this value rather than a row id, so credits span every locale variant of
	 * a byline. Nullable in the schema for backwards compatibility; new rows
	 * always populate it.
	 */
	translation_group: string | null;
}

export interface ContentBylineTable {
	id: string;
	collection_slug: string;
	content_id: string;
	byline_id: string;
	sort_order: number;
	role_label: string | null;
	created_at: Generated<string>;
}

// Byline custom fields (migration 041, Discussion #1174)
//
// `_emdash_byline_fields` stores definitions; values land in either
// `_emdash_byline_field_values` (translatable, keyed by byline row id) or
// `_emdash_byline_field_group_values` (non-translatable, keyed by
// translation_group). Per-field `translatable` flag picks the home table.

export interface BylineFieldTable {
	id: string;
	slug: string;
	label: string;
	/** One of: 'string', 'text', 'url', 'boolean', 'select'. v1 subset. */
	type: string;
	required: Generated<number>; // 0 or 1
	/** 0 = group-shared, 1 = per-locale. Defaults to 1 at the DB level. */
	translatable: Generated<number>;
	/** JSON: `{ options?: string[] }` for `select`-type fields. */
	validation: string | null;
	sort_order: Generated<number>;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

export interface BylineFieldValueTable {
	byline_id: string;
	field_id: string;
	/** JSON-encoded value (`CustomFieldValue` after parse). */
	value: string | null;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

export interface BylineFieldGroupValueTable {
	translation_group: string;
	field_id: string;
	/** JSON-encoded value (`CustomFieldValue` after parse). */
	value: string | null;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}


export interface Database {
 _emdash_bylines: BylineTable;
 _emdash_content_bylines: ContentBylineTable;
 _emdash_byline_fields: BylineFieldTable;
 _emdash_byline_field_values: BylineFieldValueTable;
 _emdash_byline_field_group_values: BylineFieldGroupValueTable;
 media: {id:string;storage_key:string;alt:string|null;blurhash:string|null;dominant_color:string|null};
 options: {name:string;value:string};
}
