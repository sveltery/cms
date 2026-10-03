// EmDash 1.1.0 taxonomy final storage shape: migrations 001,006,036,045,047–049,051,056,068,082,085.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import {sql} from 'kysely';
import type {CmsDatabase} from '../database/contract.ts';
import {registeredTaxonomyIndexes,guardedTaxonomyIndexPlan} from './collection-indexes.ts';
import {migrationObjects,type CmsMigrationProvider} from '../database/migration-provider.ts';
export function taxonomyStatements(database:CmsDatabase){const db=database.db;return [
 sql`CREATE TABLE taxonomies (id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,slug TEXT NOT NULL,label TEXT NOT NULL,parent_id TEXT,data TEXT,locale TEXT NOT NULL DEFAULT 'en',translation_group TEXT,sort_order INTEGER NOT NULL DEFAULT 0,UNIQUE(name,slug,locale))`.compile(db),
 sql`CREATE INDEX idx_taxonomies_name_locale ON taxonomies(name,locale)`.compile(db),
 sql`CREATE INDEX idx_taxonomies_locale ON taxonomies(locale)`.compile(db),
 sql`CREATE INDEX idx_taxonomies_translation_group ON taxonomies(translation_group)`.compile(db),
 sql`CREATE INDEX idx_taxonomies_parent ON taxonomies(parent_id)`.compile(db),
 sql`CREATE UNIQUE INDEX idx_taxonomies_translation_group_locale_unique ON taxonomies(translation_group,locale) WHERE translation_group IS NOT NULL`.compile(db),
 sql`CREATE TABLE content_taxonomies (collection TEXT NOT NULL,entry_id TEXT NOT NULL,taxonomy_id TEXT NOT NULL,status TEXT,scheduled_at TEXT,deleted_at TEXT,locale TEXT,published_at TEXT,created_at TEXT,PRIMARY KEY(collection,entry_id,taxonomy_id))`.compile(db),
 sql`CREATE INDEX idx_content_taxonomies_term ON content_taxonomies(taxonomy_id)`.compile(db),
 sql`CREATE INDEX idx_content_taxonomies_group_lookup ON content_taxonomies(taxonomy_id,collection,entry_id)`.compile(db),
 sql`CREATE TABLE _cms_taxonomy_defs (id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,label TEXT NOT NULL,label_singular TEXT,hierarchical INTEGER DEFAULT 0,collections TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,locale TEXT NOT NULL DEFAULT 'en',translation_group TEXT,UNIQUE(name,locale))`.compile(db),
 sql`CREATE INDEX idx__cms_taxonomy_defs_locale ON _cms_taxonomy_defs(locale)`.compile(db),
 sql`CREATE INDEX idx__cms_taxonomy_defs_translation_group ON _cms_taxonomy_defs(translation_group)`.compile(db),
 sql`CREATE TABLE _cms_taxonomy_def_groups (id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL UNIQUE,hierarchical INTEGER NOT NULL DEFAULT 0,collections TEXT NOT NULL DEFAULT '[]',created_at TEXT DEFAULT CURRENT_TIMESTAMP)`.compile(db),
 sql`INSERT INTO _cms_taxonomy_def_groups(id,name,hierarchical,collections) VALUES ('taxdef_category','category',1,'["posts"]'),('taxdef_tag','tag',0,'["posts"]')`.compile(db),
 sql`INSERT INTO _cms_taxonomy_defs(id,name,label,label_singular,hierarchical,collections,translation_group) VALUES ('taxdef_category','category','Categories','Category',1,'["posts"]','taxdef_category'),('taxdef_tag','tag','Tags','Tag',0,'["posts"]','taxdef_tag')`.compile(db)
];}
export const taxonomyMigration:CmsMigrationProvider={version:7,name:'taxonomies',async statements(database){const plan=await guardedTaxonomyIndexPlan(database);return [...plan.before,...taxonomyStatements(database),...plan.indexes,...plan.after];},async expectedObjects(database,installedVersion=0){return migrationObjects([...taxonomyStatements(database),...(installedVersion>=3?await registeredTaxonomyIndexes(database):[])]);}};
