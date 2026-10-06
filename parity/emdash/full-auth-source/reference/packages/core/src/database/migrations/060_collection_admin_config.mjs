import { columnExists } from "../dialect-helpers.js";
/** Persist collection-level admin presentation options. */
export async function up(db) {
    if (!(await columnExists(db, "_emdash_collections", "admin_config"))) {
        await db.schema.alterTable("_emdash_collections").addColumn("admin_config", "text").execute();
    }
}
export async function down(db) {
    if (await columnExists(db, "_emdash_collections", "admin_config")) {
        await db.schema.alterTable("_emdash_collections").dropColumn("admin_config").execute();
    }
}
