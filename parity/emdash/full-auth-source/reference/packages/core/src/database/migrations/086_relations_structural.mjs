import { sql } from "kysely";
import { columnExists, currentTimestamp, tableExists } from "../dialect-helpers.js";
/**
 * Collapse the per-locale rows to one row per relation, with a slug unique
 * across all of them.
 *
 * `UNIQUE(name, locale)` allowed two groups to share a name, so the collapse
 * can collide; a colliding relation takes a numeric suffix rather than failing
 * the migration. Groups are processed in a fixed order so every replica lands
 * on the same result.
 */
function collapseGroups(rows) {
    const byGroup = new Map();
    for (const row of rows) {
        const group = byGroup.get(row.translation_group);
        if (group)
            group.push(row);
        else
            byGroup.set(row.translation_group, [row]);
    }
    const collapsed = [];
    const takenSlugs = new Set();
    // Fixed order so every replica lands on the same slug suffixes.
    for (const translationGroup of [...byGroup.keys()].toSorted()) {
        const groupRows = byGroup.get(translationGroup) ?? [];
        // Structural fields are identical across a group by construction; the
        // labels are not, so the lowest locale code wins — deterministic, and it
        // keeps the default locale's wording on a two-locale site.
        const canonical = groupRows.toSorted((a, b) => (a.locale < b.locale ? -1 : 1))[0];
        if (!canonical)
            continue;
        let slug = canonical.name;
        for (let suffix = 2; takenSlugs.has(slug); suffix++) {
            slug = `${canonical.name.slice(0, 63 - String(suffix).length - 1)}_${suffix}`;
        }
        takenSlugs.add(slug);
        collapsed.push({
            id: translationGroup,
            slug,
            parent_collection: canonical.parent_collection,
            child_collection: canonical.child_collection,
            parent_label: canonical.parent_label,
            child_label: canonical.child_label,
        });
    }
    return collapsed;
}
async function createRelationsTable(db, name) {
    await db.schema
        .createTable(name)
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("slug", "text", (c) => c.notNull())
        .addColumn("parent_collection", "text", (c) => c.notNull())
        .addColumn("child_collection", "text", (c) => c.notNull())
        .addColumn("parent_label", "text", (c) => c.notNull())
        .addColumn("child_label", "text", (c) => c.notNull())
        .addColumn("parent_label_singular", "text")
        .addColumn("child_label_singular", "text")
        // NULL means unlimited on that side.
        .addColumn("max_children_per_parent", "integer")
        .addColumn("max_parents_per_child", "integer")
        .addColumn("created_at", "text", (c) => c.defaultTo(currentTimestamp(db)))
        .addColumn("updated_at", "text", (c) => c.defaultTo(currentTimestamp(db)))
        .addUniqueConstraint("_emdash_relations_slug_unique", ["slug"])
        .execute();
}
async function createRelationIndexes(db) {
    await db.schema
        .createIndex("idx__emdash_relations_parent_collection")
        .ifNotExists()
        .on("_emdash_relations")
        .column("parent_collection")
        .execute();
    await db.schema
        .createIndex("idx__emdash_relations_child_collection")
        .ifNotExists()
        .on("_emdash_relations")
        .column("child_collection")
        .execute();
}
/**
 * Rename the edge table's relation column. The column holds a relation id now,
 * not a translation group. Values are unchanged — `id` was preserved from the
 * group — so this is a rename, not a remap. SQLite and Postgres both carry
 * indexes and constraints across `RENAME COLUMN`.
 */
async function renameEdgeRelationColumn(db) {
    if (!(await columnExists(db, "_emdash_content_references", "relation_group")))
        return;
    await sql
        .raw(`ALTER TABLE "_emdash_content_references" RENAME COLUMN "relation_group" TO "relation_id"`)
        .execute(db);
}
export async function up(db) {
    // The rebuild drops the old table before renaming the new one into place, so
    // a run interrupted between those two statements leaves the data in
    // `_emdash_relations_new` and no `_emdash_relations` at all. Finish that
    // rename before anything else looks for the old table.
    if ((await tableExists(db, "_emdash_relations_new")) &&
        !(await tableExists(db, "_emdash_relations"))) {
        await sql.raw(`ALTER TABLE "_emdash_relations_new" RENAME TO "_emdash_relations"`).execute(db);
    }
    if (await columnExists(db, "_emdash_relations", "slug")) {
        // The table is already rebuilt. The edge-column rename is the last
        // statement and has its own guard, so a run interrupted between the two
        // still completes here rather than leaving `relation_group` behind
        // forever.
        await createRelationIndexes(db);
        await renameEdgeRelationColumn(db);
        return;
    }
    const existing = await sql `
		SELECT id, name, parent_collection, child_collection,
		       parent_label, child_label, locale, translation_group
		FROM ${sql.ref("_emdash_relations")}
	`.execute(db);
    const collapsed = collapseGroups(existing.rows);
    await sql.raw(`DROP TABLE IF EXISTS "_emdash_relations_new"`).execute(db);
    await createRelationsTable(db, "_emdash_relations_new");
    for (const row of collapsed) {
        // oxlint-disable-next-line no-await-in-loop -- one statement per relation; the table holds a handful of rows
        await sql `
			INSERT INTO ${sql.ref("_emdash_relations_new")}
				(id, slug, parent_collection, child_collection, parent_label, child_label)
			VALUES (${row.id}, ${row.slug}, ${row.parent_collection}, ${row.child_collection},
			        ${row.parent_label}, ${row.child_label})
		`.execute(db);
    }
    await db.schema.dropTable("_emdash_relations").execute();
    await sql.raw(`ALTER TABLE "_emdash_relations_new" RENAME TO "_emdash_relations"`).execute(db);
    await createRelationIndexes(db);
    await renameEdgeRelationColumn(db);
}
export async function down(_db) {
    // no-op: the collapse is not reversible. Each relation's per-locale rows were
    // merged into one, so the locale variants they carried no longer exist to be
    // restored — rebuilding the old shape would fabricate a single locale's
    // labels for every language.
}
