/**
 * The reference fields a collection carries, for the public query path.
 *
 * `referenceFieldConstraints` (api/handlers) answers the write question — how
 * many entries may a field select, and is it required. Rendering asks a
 * different one: which collection do I load, and which end of the relation am I
 * standing on. Both read the same rows; keeping them apart keeps the render
 * path off the relation table, which the constraints map has to read for its
 * limits.
 */
import { sql } from "kysely";
import { jsonExtractExpr } from "../database/dialect-helpers.js";
import { getDb } from "../loader.js";
import { cachedQuery, CacheNamespace } from "../object-cache/index.js";
import { requestCached } from "../request-cache.js";
import { isMissingTableError } from "../utils/db-errors.js";
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function loadBindings(db, collection) {
    // The relation's id joins in here rather than being looked up per field at
    // render time: the field stores a slug, but the link table is keyed by id.
    const relationSlug = jsonExtractExpr(db, "validation", "relation");
    let rows;
    try {
        const result = await sql `
			SELECT f.slug AS slug, f.validation AS validation, r.id AS relation_id
			FROM ${sql.ref("_emdash_fields")} AS f
			INNER JOIN ${sql.ref("_emdash_collections")} AS c ON c.id = f.collection_id
			LEFT JOIN ${sql.ref("_emdash_relations")} AS r ON r.slug = ${sql.raw(relationSlug)}
			WHERE c.slug = ${collection} AND f.type = 'reference'
		`.execute(db);
        rows = result.rows;
    }
    catch (error) {
        if (isMissingTableError(error))
            return [];
        throw error;
    }
    const bindings = [];
    for (const row of rows) {
        if (!row.validation)
            continue;
        let parsed;
        try {
            parsed = JSON.parse(row.validation);
        }
        catch {
            continue;
        }
        if (!isRecord(parsed))
            continue;
        const { relation, targetCollection } = parsed;
        // A field with neither is unbound: it keeps its own column, and its value
        // is already in `data`. There is nothing to resolve. Nor is there when the
        // named relation is gone — the join leaves no id to page by.
        if (typeof relation !== "string" || typeof targetCollection !== "string")
            continue;
        if (!row.relation_id)
            continue;
        bindings.push({
            slug: row.slug,
            relation,
            relationId: row.relation_id,
            targetCollection,
            side: parsed.relationSide === "child" ? "child" : "parent",
        });
    }
    return bindings;
}
/**
 * Every bound reference field on `collection`, by field slug.
 *
 * Cached twice over: once per request, and once in the schema object-cache
 * namespace, which a schema edit already bumps. A render that asks for
 * references therefore pays for this lookup at most once per isolate between
 * schema changes, and a render that asks for none never issues it.
 */
export function getReferenceFieldMap(collection) {
    return requestCached(`reference-field-map:${collection}`, async () => {
        const bindings = await cachedQuery({
            namespace: CacheNamespace.SCHEMA,
            key: `reference-field-map:${collection}`,
            load: async () => loadBindings(await getDb(), collection),
        });
        return new Map(bindings.map((binding) => [binding.slug, binding]));
    });
}
