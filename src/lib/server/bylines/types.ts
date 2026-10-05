// EmDash 1.1.0, immutable 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc.; MIT; notices/emdash-MIT.txt.
// Complete Source bodies with native imports/storage hosting; docs/byline-backend.md.
export type BylineFieldType = "string" | "text" | "url" | "boolean" | "select";

export const BYLINE_FIELD_TYPES: readonly BylineFieldType[] = [
	"string",
	"text",
	"url",
	"boolean",
	"select",
] as const;

/**
 * Validation rules for a byline custom field. v1 only exposes `options`
 * (the choice list for `select` fields). The shape mirrors the content-
 * field convention so the admin UI patterns transfer.
 */
export interface BylineFieldValidation {
	/** Choices for `select`-type fields. Ignored for other types. */
	options?: string[];
}

/**
 * Runtime shape of a registered byline custom field. Stored in
 * `_emdash_byline_fields` (see migration 041).
 */
export interface BylineFieldDefinition {
	id: string;
	slug: string;
	label: string;
	type: BylineFieldType;
	required: boolean;
	/**
	 * Whether values are stored per-locale (`true`, in
	 * `_emdash_byline_field_values` keyed by `byline_id`) or shared across
	 * every locale variant of the same byline identity (`false`, in
	 * `_emdash_byline_field_group_values` keyed by `translation_group`).
	 * Defaults to `true` at the DB level.
	 */
	translatable: boolean;
	validation: BylineFieldValidation | null;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

/**
 * Input for creating a byline custom field. `slug` and `type` are not
 * updatable post-create — changing either would invalidate stored values.
 */
export interface CreateBylineFieldInput {
	slug: string;
	label: string;
	type: BylineFieldType;
	required?: boolean;
	translatable?: boolean;
	validation?: BylineFieldValidation | null;
	sortOrder?: number;
}

/**
 * Input for updating a byline custom field. `slug` and `type` are
 * intentionally not present — see `CreateBylineFieldInput`.
 */
export interface UpdateBylineFieldInput {
	label?: string;
	required?: boolean;
	translatable?: boolean;
	validation?: BylineFieldValidation | null;
	sortOrder?: number;
}

/**
 * Runtime value type for a byline custom field. The narrow union mirrors
 * what the five v1 field types can produce: `string`/`text`/`url`/`select`
 * → string, `boolean` → boolean, plus `null` for cleared values.
 */
export type CustomFieldValue = string | boolean | null;

/**
 * Reserved byline-field slugs. Two reasons a slug ends up here:
 *
 * 1. **Column collision.** Slugs that match a fixed column on
 *    `_emdash_bylines` (migrations 031 + 040) would shadow that column
 *    on hydration. The first 12 entries cover this.
 * 2. **Route collision.** Static file routes under
 *    `/_emdash/api/admin/byline-fields/` take precedence over the
 *    `[slug].ts` dynamic route in Astro, so a custom field whose slug
 *    matches a sibling static file (e.g. `reorder.ts`) is unreachable
 *    via single-field CRUD — the static route handles only its own
 *    method (POST for `reorder`) and 405s everything else.
 *    `reorder` is the only such sibling today; new sibling routes
 *    (e.g. a hypothetical `import.ts`) must be added here.
 *    `[slug]/usage.ts` lives a level deeper so a slug of `usage` does
 *    not collide — it resolves cleanly to `[slug].ts`.
 *
 * Enforced at the registry layer (Phase 2) and the admin API zod layer
 * (Phase 4) so non-HTTP callers (seeds, scripts) get the same guarantee.
 */
export const RESERVED_BYLINE_FIELD_SLUGS = [
	// 1. Column-collision slugs (matches `_emdash_bylines` fixed columns).
	"id",
	"slug",
	"display_name",
	"bio",
	"avatar_media_id",
	"website_url",
	"user_id",
	"is_guest",
	"locale",
	"translation_group",
	"created_at",
	"updated_at",
	// 2. Route-collision slugs (matches static sibling files of `[slug].ts`).
	"reorder",
] as const;
