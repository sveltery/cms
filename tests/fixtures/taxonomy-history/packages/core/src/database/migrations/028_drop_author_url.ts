// @ts-nocheck -- immutable source fixture; host seams are checked separately.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`ALTER TABLE _emdash_comments DROP COLUMN author_url`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("_emdash_comments").addColumn("author_url", "text").execute();
}
