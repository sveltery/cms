// Source MenuTable/MenuItemTable, immutable EmDash1.1.0; Copyright2026CloudflareInc.; MIT.
import type { Generated } from "kysely";
import type { CollectionRow } from "../database/contract.ts";
export interface MenuTable {
	id: string;
	name: string;
	label: string;
	created_at: Generated<string>;
	updated_at: Generated<string>;
	locale: Generated<string>;
	translation_group: string | null;
}

export interface MenuItemTable {
	id: string;
	menu_id: string;
	parent_id: string | null;
	sort_order: number;
	type: string;
	reference_collection: string | null;
	reference_id: string | null; // stores translation_group of referenced content/term
	custom_url: string | null;
	label: string;
	title_attr: string | null;
	target: string | null;
	css_classes: string | null;
	created_at: Generated<string>;
	locale: Generated<string>;
	translation_group: string | null;
}


export interface Database {
 _emdash_menus: MenuTable;
 _emdash_menu_items: MenuItemTable;
 _emdash_collections: CollectionRow;
 taxonomies: {id:string;name:string;slug:string;label:string;parent_id:string|null;data:string|null;locale:string;translation_group:string|null};
}
