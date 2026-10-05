// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/taxonomies/types.ts
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Whole Source behavior; Native import/type hosting only.
/**
 * Taxonomy types for EmDash CMS
 */

/**
 * Taxonomy definition - describes a taxonomy like "category" or "tag"
 */
export interface TaxonomyDef {
	id: string;
	name: string; // 'category', 'tag', 'genre'
	label: string; // 'Categories', 'Tags'
	labelSingular?: string; // 'Category', 'Tag'
	hierarchical: boolean;
	collections: string[]; // ['posts', 'pages']
	locale: string; // e.g. 'en', 'es'
	translationGroup: string | null; // shared id across translations of the same def
}

/**
 * Taxonomy term - a specific term within a taxonomy (e.g., "News" in "category")
 */
export interface TaxonomyTerm {
	id: string;
	name: string; // Taxonomy name ('category')
	slug: string; // Term slug ('news')
	label: string; // Display label ('News')
	parentId?: string;
	description?: string;
	children: TaxonomyTerm[]; // For tree structure
	count?: number; // Entry count
	locale: string;
	translationGroup: string | null;
}

/**
 * Flat version for DB row
 */
export interface TaxonomyTermRow {
	id: string;
	name: string;
	slug: string;
	label: string;
	parent_id: string | null;
	data: string | null; // JSON
	locale: string;
	translation_group: string | null;
}

/**
 * Input for creating a term
 */
export interface CreateTermInput {
	slug: string;
	label: string;
	parentId?: string;
	description?: string;
	locale?: string;
	/** When set, links the new term into an existing translation_group (sourced
	 * from the term being translated). */
	translationOf?: string;
}

/**
 * Input for updating a term
 */
export interface UpdateTermInput {
	slug?: string;
	label?: string;
	parentId?: string | null;
	description?: string;
}
