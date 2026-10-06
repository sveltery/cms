import { sql } from "kysely";
export async function up(db) {
    await sql `
		INSERT INTO options (name, value)
		SELECT 'emdash:seed_complete', 'true'
		WHERE EXISTS (SELECT 1 FROM _emdash_collections)
		ON CONFLICT (name) DO NOTHING
	`.execute(db);
}
export async function down(_db) { }
