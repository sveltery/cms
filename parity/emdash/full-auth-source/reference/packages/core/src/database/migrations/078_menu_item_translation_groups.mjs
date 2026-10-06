import { sql } from "kysely";
export async function up(db) {
    await sql `
		UPDATE _emdash_menu_items
		SET translation_group = id
		WHERE translation_group IS NULL
	`.execute(db);
}
/** Existing translation-group relationships must survive a host rollback. */
export async function down(_db) {
    // no-op
}
