import { sql } from "kysely";
import { monotonicFactory } from "ulidx";
import { ContentDatetimeNormalizer } from "../content-datetime.js";
import { validateIdentifier } from "../validate.js";
const monotonic = monotonicFactory();
export function createRevisionId() {
    return monotonic();
}
export function normalizeRevisionLimit(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return 50;
    return Math.max(1, Math.min(Math.trunc(numeric), 100));
}
/**
 * Revision repository for version history
 *
 * Each revision stores a JSON snapshot of the content at a point in time.
 * Used when collection has `supports: ["revisions"]` enabled.
 */
export class RevisionRepository {
    db;
    datetimes;
    constructor(db, datetimeContexts) {
        this.db = db;
        this.datetimes = new ContentDatetimeNormalizer(db, datetimeContexts);
    }
    /**
     * Create a new revision
     */
    async create(input) {
        const id = createRevisionId();
        const data = await this.datetimes.normalizeData(input.collection, input.data);
        const row = {
            id,
            collection: input.collection,
            entry_id: input.entryId,
            data: JSON.stringify(data),
            author_id: input.authorId ?? null,
        };
        await this.db.insertInto("revisions").values(row).execute();
        const revision = await this.findById(id);
        if (!revision) {
            throw new Error("Failed to create revision");
        }
        await this.queuePruning(input.collection, input.entryId, id);
        return revision;
    }
    async queuePruning(collection, entryId, revisionId) {
        try {
            await this.db
                .insertInto("_emdash_revision_prune_queue")
                .values({
                collection,
                entry_id: entryId,
                revision_id: revisionId,
            })
                .onConflict((conflict) => conflict.columns(["collection", "entry_id"]).doUpdateSet({ revision_id: revisionId }))
                .execute();
        }
        catch (error) {
            console.error(`[revisions] Failed to queue revision pruning for ${collection}/${entryId}:`, error);
        }
    }
    /**
     * Find revision by ID
     */
    async findById(id) {
        const row = await this.db
            .selectFrom("revisions")
            .selectAll()
            .where("id", "=", id)
            .executeTakeFirst();
        return row ? this.normalizeRow(row) : null;
    }
    /** Shallow-merge `patch` into a stored revision's data. */
    async mergeData(id, patch) {
        const row = await this.db
            .selectFrom("revisions")
            .select("data")
            .where("id", "=", id)
            .executeTakeFirst();
        if (!row)
            return;
        const data = { ...JSON.parse(row.data), ...patch };
        await this.db
            .updateTable("revisions")
            .set({ data: JSON.stringify(data) })
            .where("id", "=", id)
            .execute();
    }
    /**
     * Get all revisions for an entry (newest first)
     *
     * Orders by monotonic ULID (descending). The monotonic factory
     * guarantees strictly increasing IDs even within the same millisecond.
     */
    async findByEntry(collection, entryId, options = {}) {
        let query = this.db
            .selectFrom("revisions")
            .selectAll()
            .where("collection", "=", collection)
            .where("entry_id", "=", entryId)
            .orderBy("id", "desc");
        if (options.limit) {
            query = query.limit(options.limit);
        }
        const rows = await query.execute();
        const data = await this.datetimes.normalizeDataMany(collection, rows.map((row) => JSON.parse(row.data)));
        return rows.map((row, index) => {
            const normalized = data[index];
            if (!normalized)
                throw new Error("Failed to normalize revision data");
            return this.rowToRevision(row, normalized);
        });
    }
    /** Read revisions only when the owning content row is visible in the same statement snapshot. */
    async findVisibleByEntry(collection, entryId, options = {}) {
        validateIdentifier(collection, "collection");
        const tableName = `ec_${collection}`;
        const limit = normalizeRevisionLimit(options.limit);
        const result = await sql `
			SELECT revisions.* FROM revisions
			WHERE revisions.collection = ${collection}
			AND revisions.entry_id = ${entryId}
			AND EXISTS (
				SELECT 1 FROM ${sql.ref(tableName)} AS content
				WHERE content.id = ${entryId}
				AND content.deleted_at IS NULL
			)
			ORDER BY revisions.id DESC
			LIMIT ${limit}
		`.execute(this.db);
        const data = await this.datetimes.normalizeDataMany(collection, result.rows.map((row) => JSON.parse(row.data)));
        return result.rows.map((row, index) => {
            const normalized = data[index];
            if (!normalized)
                throw new Error("Failed to normalize revision data");
            return this.rowToRevision(row, normalized);
        });
    }
    /** Read one revision only when its owning content row is visible in the same statement snapshot. */
    async findVisibleById(collection, entryId, revisionId) {
        validateIdentifier(collection, "collection");
        const tableName = `ec_${collection}`;
        const result = await sql `
			SELECT revisions.* FROM revisions
			WHERE revisions.id = ${revisionId}
			AND revisions.collection = ${collection}
			AND revisions.entry_id = ${entryId}
			AND EXISTS (
				SELECT 1 FROM ${sql.ref(tableName)} AS content
				WHERE content.id = ${entryId}
				AND content.deleted_at IS NULL
			)
			LIMIT 1
		`.execute(this.db);
        const row = result.rows[0];
        return row ? this.normalizeRow(row) : null;
    }
    /**
     * Get the most recent revision for an entry
     */
    async findLatest(collection, entryId) {
        const row = await this.db
            .selectFrom("revisions")
            .selectAll()
            .where("collection", "=", collection)
            .where("entry_id", "=", entryId)
            .orderBy("id", "desc")
            .limit(1)
            .executeTakeFirst();
        return row ? this.normalizeRow(row) : null;
    }
    /**
     * Count revisions for an entry
     */
    async countByEntry(collection, entryId) {
        const result = await this.db
            .selectFrom("revisions")
            .select((eb) => eb.fn.count("id").as("count"))
            .where("collection", "=", collection)
            .where("entry_id", "=", entryId)
            .executeTakeFirst();
        return Number(result?.count || 0);
    }
    /**
     * Delete all revisions for an entry (use when entry is deleted)
     */
    async deleteByEntry(collection, entryId) {
        const result = await this.db
            .deleteFrom("revisions")
            .where("collection", "=", collection)
            .where("entry_id", "=", entryId)
            .executeTakeFirst();
        try {
            await this.db
                .deleteFrom("_emdash_revision_prune_queue")
                .where("collection", "=", collection)
                .where("entry_id", "=", entryId)
                .execute();
        }
        catch (error) {
            console.error(`[revisions] Failed to clear queued revision pruning for ${collection}/${entryId}:`, error);
        }
        return Number(result.numDeletedRows ?? 0);
    }
    /**
     * Delete old revisions, keeping the most recent N
     */
    async pruneOldRevisions(collection, entryId, keepCount, throughRevisionId) {
        validateIdentifier(collection, "collection");
        const tableName = `ec_${collection}`;
        let keepQuery = this.db
            .selectFrom("revisions")
            .select("id")
            .where("collection", "=", collection)
            .where("entry_id", "=", entryId)
            .orderBy("created_at", "desc")
            .orderBy("id", "desc") // ULID tiebreaker
            .limit(keepCount);
        if (throughRevisionId) {
            keepQuery = keepQuery.where("id", "<=", throughRevisionId);
        }
        const keep = await keepQuery.execute();
        const keepIds = keep.map((r) => r.id);
        if (keepIds.length === 0)
            return 0;
        const revisionBoundary = throughRevisionId ? sql `AND id <= ${throughRevisionId}` : sql ``;
        const result = await sql `
			DELETE FROM revisions
			WHERE collection = ${collection}
			AND entry_id = ${entryId}
			${revisionBoundary}
			AND id NOT IN (${sql.join(keepIds.map((id) => sql `${id}`))})
			AND NOT EXISTS (
				SELECT 1 FROM ${sql.ref(tableName)} AS content
				WHERE content.live_revision_id = revisions.id
				OR content.draft_revision_id = revisions.id
			)
		`.execute(this.db);
        return Number(result.numAffectedRows ?? 0);
    }
    async pruneQueuedEntry(collection, entryId, queuedRevisionId, keepCount) {
        const pruned = await this.pruneOldRevisions(collection, entryId, keepCount, queuedRevisionId);
        await this.db
            .deleteFrom("_emdash_revision_prune_queue")
            .where("collection", "=", collection)
            .where("entry_id", "=", entryId)
            .where("revision_id", "=", queuedRevisionId)
            .execute();
        return pruned;
    }
    async deleteIfUnreferenced(collection, entryId, revisionId) {
        validateIdentifier(collection, "collection");
        const tableName = `ec_${collection}`;
        const result = await sql `
			DELETE FROM revisions
			WHERE id = ${revisionId}
			AND collection = ${collection}
			AND entry_id = ${entryId}
			AND NOT EXISTS (
				SELECT 1 FROM ${sql.ref(tableName)} AS content
				WHERE content.live_revision_id = revisions.id
				OR content.draft_revision_id = revisions.id
			)
		`.execute(this.db);
        return (result.numAffectedRows ?? 0n) > 0n;
    }
    /**
     * Convert database row to Revision object
     */
    async normalizeRow(row) {
        const data = await this.datetimes.normalizeData(row.collection, JSON.parse(row.data));
        return this.rowToRevision(row, data);
    }
    rowToRevision(row, data) {
        return {
            id: row.id,
            collection: row.collection,
            entryId: row.entry_id,
            data,
            authorId: row.author_id,
            createdAt: row.created_at,
        };
    }
}
