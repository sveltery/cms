import { sql } from "kysely";
import { isSqlite } from "../dialect-helpers.js";
import { validateIdentifier } from "../validate.js";
export async function up(db) {
    if (!isSqlite(db))
        return;
    const collections = await sql `
		SELECT slug, search_config FROM _emdash_collections
		WHERE search_config IS NOT NULL
	`.execute(db);
    for (const collection of collections.rows) {
        if (!isSearchEnabled(collection.search_config))
            continue;
        // Slug came from `_emdash_collections.slug`, where the schema
        // registry validates it against the same identifier rules on
        // write. Re-validate here defensively before interpolating it
        // into raw SQL -- this is a migration, so a malformed slug
        // that somehow landed in the DB must not become an injection
        // vector.
        try {
            validateIdentifier(collection.slug, "collection slug");
        }
        catch (error) {
            console.warn(`[migration 039] skipping FTS rebuild for collection "${collection.slug}": ${error instanceof Error ? error.message : String(error)}`);
            continue;
        }
        const fields = await getSearchableFields(db, collection.slug);
        if (fields.length === 0) {
            // `search_config.enabled = true` but no searchable fields:
            // disable search and drop any orphan FTS objects. This
            // matches FTSManager's "no fields -> disable" behavior.
            await dropFtsObjects(db, collection.slug);
            await sql `
				UPDATE _emdash_collections
				SET search_config = json_set(search_config, '$.enabled', json('false'))
				WHERE slug = ${collection.slug}
			`.execute(db);
            continue;
        }
        await rebuildIndex(db, collection.slug, fields);
    }
}
/**
 * Forward-only migration. Down is a no-op: we cannot meaningfully
 * "restore the broken triggers" and there is no migration-level state
 * to roll back. The FTS tables themselves are managed by `FTSManager`
 * at runtime, not by this migration, so leaving them in their
 * corruption-safe state on rollback is correct.
 */
export async function down(_db) {
    // no-op
}
function isSearchEnabled(searchConfig) {
    if (!searchConfig)
        return false;
    try {
        const parsed = JSON.parse(searchConfig);
        return (typeof parsed === "object" &&
            parsed !== null &&
            "enabled" in parsed &&
            parsed.enabled === true);
    }
    catch {
        return false;
    }
}
async function getSearchableFields(db, collectionSlug) {
    const rows = await sql `
		SELECT f.slug FROM _emdash_fields f
		INNER JOIN _emdash_collections c ON c.id = f.collection_id
		WHERE c.slug = ${collectionSlug} AND f.searchable = 1
	`.execute(db);
    const out = [];
    for (const row of rows.rows) {
        try {
            validateIdentifier(row.slug, "searchable field name");
            out.push(row.slug);
        }
        catch {
            console.warn(`[migration 039] skipping invalid searchable field "${row.slug}" on collection "${collectionSlug}"`);
        }
    }
    return out;
}
async function rebuildIndex(db, collectionSlug, fields) {
    const ftsTable = `_emdash_fts_${collectionSlug}`;
    const contentTable = `ec_${collectionSlug}`;
    const columnList = ["id UNINDEXED", "locale UNINDEXED", ...fields].join(", ");
    const fieldList = fields.join(", ");
    const newFieldList = fields.map((f) => `NEW.${f}`).join(", ");
    const oldFieldList = fields.map((f) => `OLD.${f}`).join(", ");
    await dropFtsObjects(db, collectionSlug);
    // `IF NOT EXISTS` on every CREATE so concurrent migrators on D1
    // (no advisory lock, see runner.ts:264) converge instead of one
    // failing the other. Duplicate-rowid INSERTs into an external-
    // content FTS5 table dedupe via the docsize shadow table, so a
    // double populate ends with one row per content row. The brief
    // window between DROP and CREATE where another isolate could fire
    // a trigger against a missing FTS table is pre-existing -- it also
    // exists in FTSManager.rebuildIndex at runtime.
    await sql
        .raw(`
		CREATE VIRTUAL TABLE IF NOT EXISTS "${ftsTable}" USING fts5(
			${columnList},
			content='${contentTable}',
			content_rowid='rowid',
			tokenize='porter unicode61'
		)
	`)
        .execute(db);
    // Insert trigger -- only index non-deleted content.
    await sql
        .raw(`
		CREATE TRIGGER IF NOT EXISTS "${ftsTable}_insert"
		AFTER INSERT ON "${contentTable}"
		WHEN NEW.deleted_at IS NULL
		BEGIN
			INSERT INTO "${ftsTable}"(rowid, id, locale, ${fieldList})
			VALUES (NEW.rowid, NEW.id, NEW.locale, ${newFieldList});
		END
	`)
        .execute(db);
    // Update trigger -- corruption-safe external-content `'delete'` form,
    // gated on OLD.deleted_at IS NULL so we never issue `'delete'` for a
    // rowid that was never indexed.
    await sql
        .raw(`
		CREATE TRIGGER IF NOT EXISTS "${ftsTable}_update"
		AFTER UPDATE ON "${contentTable}"
		BEGIN
			INSERT INTO "${ftsTable}"("${ftsTable}", rowid, id, locale, ${fieldList})
			SELECT 'delete', OLD.rowid, OLD.id, OLD.locale, ${oldFieldList}
			WHERE OLD.deleted_at IS NULL;
			INSERT INTO "${ftsTable}"(rowid, id, locale, ${fieldList})
			SELECT NEW.rowid, NEW.id, NEW.locale, ${newFieldList}
			WHERE NEW.deleted_at IS NULL;
		END
	`)
        .execute(db);
    // Delete trigger -- same corruption-safe form, same gate.
    await sql
        .raw(`
		CREATE TRIGGER IF NOT EXISTS "${ftsTable}_delete"
		AFTER DELETE ON "${contentTable}"
		BEGIN
			INSERT INTO "${ftsTable}"("${ftsTable}", rowid, id, locale, ${fieldList})
			SELECT 'delete', OLD.rowid, OLD.id, OLD.locale, ${oldFieldList}
			WHERE OLD.deleted_at IS NULL;
		END
	`)
        .execute(db);
    // Populate from existing content (non-deleted rows only). Concurrent
    // re-population is safe -- FTS5 INSERT into an external-content table
    // dedupes by rowid; a second pass over the same content rows leaves
    // the index with one entry per row, matching what we'd get from a
    // single populate.
    await sql
        .raw(`
		INSERT INTO "${ftsTable}"(rowid, id, locale, ${fieldList})
		SELECT rowid, id, locale, ${fieldList} FROM "${contentTable}"
		WHERE deleted_at IS NULL
	`)
        .execute(db);
}
async function dropFtsObjects(db, collectionSlug) {
    const ftsTable = `_emdash_fts_${collectionSlug}`;
    await sql.raw(`DROP TRIGGER IF EXISTS "${ftsTable}_insert"`).execute(db);
    await sql.raw(`DROP TRIGGER IF EXISTS "${ftsTable}_update"`).execute(db);
    await sql.raw(`DROP TRIGGER IF EXISTS "${ftsTable}_delete"`).execute(db);
    await sql.raw(`DROP TABLE IF EXISTS "${ftsTable}"`).execute(db);
}
