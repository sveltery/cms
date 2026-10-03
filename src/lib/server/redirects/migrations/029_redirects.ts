// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc.; see notices/emdash-MIT.txt.
// Source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/database/migrations/029_redirects.ts; blob 72e7e30685314fe35a214352580243c6a94ace06.
import type { Kysely } from "kysely";

import { currentTimestamp } from "../../database/lifecycle/upstream/database/dialect-helpers.ts";

export async function up(db: Kysely<unknown>): Promise<void> {
	// Redirect rules table
	await db.schema
		.createTable("_cms_redirects")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("source", "text", (col) => col.notNull())
		.addColumn("destination", "text", (col) => col.notNull())
		.addColumn("type", "integer", (col) => col.notNull().defaultTo(301))
		.addColumn("is_pattern", "integer", (col) => col.notNull().defaultTo(0))
		.addColumn("enabled", "integer", (col) => col.notNull().defaultTo(1))
		.addColumn("hits", "integer", (col) => col.notNull().defaultTo(0))
		.addColumn("last_hit_at", "text")
		.addColumn("group_name", "text")
		.addColumn("auto", "integer", (col) => col.notNull().defaultTo(0))
		.addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.execute();

	// Unique source for exact (non-pattern) rules
	// SQLite doesn't support partial indexes with WHERE on all versions,
	// so we use a regular index and enforce uniqueness in the application layer
	await db.schema
		.createIndex("idx_redirects_source")
		.on("_cms_redirects")
		.column("source")
		.execute();

	await db.schema
		.createIndex("idx_redirects_enabled")
		.on("_cms_redirects")
		.column("enabled")
		.execute();

	await db.schema
		.createIndex("idx_redirects_group")
		.on("_cms_redirects")
		.column("group_name")
		.execute();

	// 404 log table
	await db.schema
		.createTable("_cms_404_log")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("path", "text", (col) => col.notNull())
		.addColumn("referrer", "text")
		.addColumn("user_agent", "text")
		.addColumn("ip", "text")
		.addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db)))
		.execute();

	await db.schema.createIndex("idx_404_log_path").on("_cms_404_log").column("path").execute();

	await db.schema
		.createIndex("idx_404_log_created")
		.on("_cms_404_log")
		.column("created_at")
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("_cms_404_log").execute();
	await db.schema.dropTable("_cms_redirects").execute();
}
