// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Immutable EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; source packages/core/src/content-list-query.ts; blob 075fbabc173e1eac9c04edcaab98939c9fef271c.
/** Scalar values accepted by indexed content-field filters. */
export type ContentFieldFilterScalar = string | number | boolean | null;

/** Inclusive or exclusive bounds for an indexed scalar field. */
export interface ContentFieldRangeFilter {
	gt?: string | number;
	gte?: string | number;
	lt?: string | number;
	lte?: string | number;
}

/** Match any one of the supplied values. */
export interface ContentFieldInFilter {
	in: Array<string | number | boolean>;
}

/** A single indexed content-field condition. */
export type ContentFieldFilterValue =
	| ContentFieldFilterScalar
	| ContentFieldRangeFilter
	| ContentFieldInFilter;

/**
 * Indexed custom-field filters, combined with AND semantics.
 *
 * A scalar performs an exact match, `null` matches missing values, `{ in: [...] }`
 * performs membership matching, and range bounds can be combined.
 */
export type ContentFieldFilters = Record<string, ContentFieldFilterValue>;
