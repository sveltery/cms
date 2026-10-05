// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Whole selected interfaces from the retained pinned database/types.ts authority.
import type { Generated } from "kysely";
import type {CollectionRow,FieldRow} from "../database/contract.ts";

export interface TaxonomyTable {
	id: string;
	name: string;
	slug: string;
	label: string;
	parent_id: string | null;
	data: string | null; // JSON
	locale: Generated<string>; // e.g. 'en', 'es', 'fr'
	translation_group: string | null; // shared across translations of the same term
	// Manual order within a sibling group. 0 for terms that were never
	// explicitly reordered, so listings fall back to alphabetical.
	sort_order: Generated<number>;
}

export interface ContentTaxonomyTable {
	collection: string; // e.g., 'posts'
	entry_id: string; // stores the ec_* row's translation_group (locale-agnostic)
	taxonomy_id: string; // stores taxonomies.translation_group (locale-agnostic)
	// Legacy denormalized columns from migration 051. A group assignment spans
	// locale rows whose status and dates may differ, so current reads use the
	// authoritative ec_* rows and new pivot inserts leave these nullable.
	status: Generated<string | null>;
	scheduled_at: Generated<string | null>;
	deleted_at: Generated<string | null>;
	locale: Generated<string | null>;
	published_at: Generated<string | null>;
	created_at: Generated<string | null>;
}

export interface TaxonomyDefTable {
	id: string;
	name: string;
	label: string;
	label_singular: string | null;
	hierarchical: number; // 0 or 1 (SQLite boolean)
	collections: string | null; // JSON array
	created_at: Generated<string>;
	locale: Generated<string>;
	translation_group: string | null;
}

export interface TaxonomyDefGroupTable {
	id: string;
	name: string;
	hierarchical: Generated<number>; // 0 or 1 (SQLite boolean)
	collections: Generated<string>; // JSON array
	created_at: Generated<string>;
}

export interface OptionTable {
	name: string;
	value: string; // JSON
	revision: Generated<string>;
}

export interface PluginStorageTable {
	plugin_id: string;
	collection: string;
	id: string;
	data: string; // JSON
	revision: Generated<string>;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

export interface PluginStateTable {
	plugin_id: string;
	version: string;
	status: string; // 'installed' | 'active' | 'inactive'
	installed_at: Generated<string>;
	activated_at: string | null;
	deactivated_at: string | null;
	data: string | null; // JSON
	source: Generated<string>; // 'config' | 'marketplace' | 'registry'
	marketplace_version: string | null;
	display_name: string | null;
	description: string | null;
	// Registry-specific columns (added by migration 038). Always null for
	// `source = 'config' | 'marketplace'`; populated for `source = 'registry'`.
	registry_publisher_did: string | null;
	registry_slug: string | null;
	mcp_tools_enabled: Generated<number>;
	mcp_tools_consent: string | null;
}

export interface PluginIndexTable {
	plugin_id: string;
	collection: string;
	index_name: string;
	fields: string; // JSON array of field paths
	created_at: Generated<string>;
}

export interface Database {
 _emdash_collections:CollectionRow;
 _emdash_fields:FieldRow;
 options: OptionTable;
 taxonomies: TaxonomyTable;
 content_taxonomies: ContentTaxonomyTable;
 _emdash_taxonomy_defs: TaxonomyDefTable;
 _emdash_taxonomy_def_groups: TaxonomyDefGroupTable;
}
