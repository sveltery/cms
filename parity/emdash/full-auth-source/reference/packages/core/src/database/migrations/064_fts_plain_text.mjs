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
        // Defensive re-validation before raw SQL interpolation, mirroring 039.
        try {
            validateIdentifier(collection.slug, "collection slug");
        }
        catch (error) {
            console.warn(`[migration 064] skipping FTS rebuild for collection "${collection.slug}": ${error instanceof Error ? error.message : String(error)}`);
            continue;
        }
        const fields = await getSearchableFields(db, collection.slug);
        if (fields.length === 0)
            continue;
        await rebuildIndex(db, collection.slug, fields, searchTokenizer(collection.search_config));
    }
}
/**
 * Forward-only. Down is a no-op: the FTS tables are managed by FTSManager
 * at runtime and the self-contained shape remains fully functional for
 * older code paths that only MATCH and join on id.
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
/**
 * Tokenizers this migration knows how to carry across the rebuild — a frozen
 * copy of SEARCH_TOKENIZERS as of this migration, not an import: a replay
 * after the live allowlist changes must not reinterpret configs this
 * migration never shipped with.
 */
const KNOWN_TOKENIZERS = ["porter unicode61", "unicode61", "trigram"];
/**
 * Tokenizer for the rebuilt table, from the collection's search_config.
 * Values outside the allowlist (or unparsable config) fall back to the
 * default rather than reaching the raw CREATE VIRTUAL TABLE statement.
 */
function searchTokenizer(searchConfig) {
    if (!searchConfig)
        return "porter unicode61";
    try {
        const parsed = JSON.parse(searchConfig);
        if (typeof parsed === "object" && parsed !== null && "tokenize" in parsed) {
            const configured = KNOWN_TOKENIZERS.find((tokenizer) => tokenizer === parsed.tokenize);
            if (configured !== undefined)
                return configured;
        }
    }
    catch {
        return "porter unicode61";
    }
    return "porter unicode61";
}
async function getSearchableFields(db, collectionSlug) {
    const rows = await sql `
		SELECT f.slug, f.type FROM _emdash_fields f
		INNER JOIN _emdash_collections c ON c.id = f.collection_id
		WHERE c.slug = ${collectionSlug} AND f.searchable = 1
	`.execute(db);
    const out = [];
    for (const row of rows.rows) {
        try {
            validateIdentifier(row.slug, "searchable field name");
            out.push(row);
        }
        catch {
            console.warn(`[migration 064] skipping invalid searchable field "${row.slug}" on collection "${collectionSlug}"`);
        }
    }
    return out;
}
/** Indexed-value expression for one field; lock-step with FTSManager.searchValueExpr. */
function searchValueExpr(ref, fieldType) {
    if (fieldType !== "portableText")
        return ref;
    return (`CASE WHEN ${ref} IS NULL THEN NULL ` +
        `WHEN json_valid(${ref}) AND json_type(${ref}) IN ('array', 'object') THEN (` +
        `SELECT group_concat(j.value, ' ') FROM json_tree(${ref}) AS j ` +
        `WHERE j.key IN ('text', 'alt', 'caption', 'code') AND j.type = 'text') ` +
        `ELSE ${ref} END`);
}
async function rebuildIndex(db, collectionSlug, fields, tokenizer) {
    const ftsTable = `_emdash_fts_${collectionSlug}`;
    const contentTable = `ec_${collectionSlug}`;
    const slugs = fields.map((f) => f.slug);
    const columnList = ["id UNINDEXED", "locale UNINDEXED", ...slugs].join(", ");
    const fieldList = slugs.join(", ");
    const newValueList = fields.map((f) => searchValueExpr(`NEW.${f.slug}`, f.type)).join(", ");
    // The WHEN guard compares raw column values (null-safe IS NOT) so the
    // update trigger fires only when an indexed value, the row's locale, or
    // its trash state actually changed; without it every UPDATE re-tokenizes
    // the whole document. deleted_at must stay in the guard or trash and
    // restore stop syncing the index.
    const changedCondition = ["deleted_at", "locale", ...slugs]
        .map((f) => `OLD.${f} IS NOT NEW.${f}`)
        .join(" OR ");
    // Table-qualified: a bare column reference inside the json_tree extraction
    // subquery binds to json_tree's own key/value/type/... columns.
    const selectValueList = fields
        .map((f) => searchValueExpr(`"${contentTable}"."${f.slug}"`, f.type))
        .join(", ");
    await sql.raw(`DROP TRIGGER IF EXISTS "${ftsTable}_insert"`).execute(db);
    await sql.raw(`DROP TRIGGER IF EXISTS "${ftsTable}_update"`).execute(db);
    await sql.raw(`DROP TRIGGER IF EXISTS "${ftsTable}_delete"`).execute(db);
    await sql.raw(`DROP TABLE IF EXISTS "${ftsTable}"`).execute(db);
    await sql
        .raw(`
		CREATE VIRTUAL TABLE IF NOT EXISTS "${ftsTable}" USING fts5(
			${columnList},
			tokenize='${tokenizer}'
		)
	`)
        .execute(db);
    await sql
        .raw(`
		CREATE TRIGGER IF NOT EXISTS "${ftsTable}_insert"
		AFTER INSERT ON "${contentTable}"
		WHEN NEW.deleted_at IS NULL
		BEGIN
			INSERT OR REPLACE INTO "${ftsTable}"(rowid, id, locale, ${fieldList})
			VALUES (NEW.rowid, NEW.id, NEW.locale, ${newValueList});
		END
	`)
        .execute(db);
    await sql
        .raw(`
		CREATE TRIGGER IF NOT EXISTS "${ftsTable}_update"
		AFTER UPDATE ON "${contentTable}"
		WHEN ${changedCondition}
		BEGIN
			DELETE FROM "${ftsTable}" WHERE rowid = OLD.rowid;
			INSERT INTO "${ftsTable}"(rowid, id, locale, ${fieldList})
			SELECT NEW.rowid, NEW.id, NEW.locale, ${newValueList}
			WHERE NEW.deleted_at IS NULL;
		END
	`)
        .execute(db);
    await sql
        .raw(`
		CREATE TRIGGER IF NOT EXISTS "${ftsTable}_delete"
		AFTER DELETE ON "${contentTable}"
		BEGIN
			DELETE FROM "${ftsTable}" WHERE rowid = OLD.rowid;
		END
	`)
        .execute(db);
    await sql
        .raw(`
		INSERT OR REPLACE INTO "${ftsTable}"(rowid, id, locale, ${fieldList})
		SELECT rowid, id, locale, ${selectValueList} FROM "${contentTable}"
		WHERE deleted_at IS NULL
	`)
        .execute(db);
}
