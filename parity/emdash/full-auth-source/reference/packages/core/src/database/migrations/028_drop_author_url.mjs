import { sql } from "kysely";
export async function up(db) {
    await sql `ALTER TABLE _emdash_comments DROP COLUMN author_url`.execute(db);
}
export async function down(db) {
    await db.schema.alterTable("_emdash_comments").addColumn("author_url", "text").execute();
}
