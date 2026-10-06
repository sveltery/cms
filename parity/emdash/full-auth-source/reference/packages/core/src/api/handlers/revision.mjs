/**
 * Revision history handlers
 */
import { after } from "../../after.js";
import { ContentRepository } from "../../database/repositories/content.js";
import { RevisionRepository } from "../../database/repositories/revision.js";
import { ContentMutationConflictError } from "../../database/repositories/types.js";
import { encodeRev } from "../rev.js";
import { applyStagedReferences, readStagedReferences, STAGED_REFERENCES_BASELINE_KEY, validateStagedReferences, } from "./staged-references.js";
/**
 * List revisions for a content entry
 */
export async function handleRevisionList(db, collection, entryId, params = {}) {
    try {
        const repo = new RevisionRepository(db);
        const [items, total] = await Promise.all([
            repo.findByEntry(collection, entryId, {
                limit: Math.max(1, Math.min(params.limit || 50, 100)),
            }),
            repo.countByEntry(collection, entryId),
        ]);
        return {
            success: true,
            data: { items, total },
        };
    }
    catch {
        return {
            success: false,
            error: {
                code: "REVISION_LIST_ERROR",
                message: "Failed to list revisions",
            },
        };
    }
}
/**
 * Get a specific revision
 */
export async function handleRevisionGet(db, revisionId) {
    try {
        const repo = new RevisionRepository(db);
        const item = await repo.findById(revisionId);
        if (!item) {
            return {
                success: false,
                error: {
                    code: "NOT_FOUND",
                    message: `Revision not found: ${revisionId}`,
                },
            };
        }
        return {
            success: true,
            data: { item },
        };
    }
    catch {
        return {
            success: false,
            error: {
                code: "REVISION_GET_ERROR",
                message: "Failed to get revision",
            },
        };
    }
}
/**
 * Restore a revision (updates content to this revision's data and creates new revision)
 */
export async function handleRevisionRestore(db, revisionId, callerUserId) {
    try {
        const revisionRepo = new RevisionRepository(db);
        // Get the revision
        const revision = await revisionRepo.findById(revisionId);
        if (!revision) {
            return {
                success: false,
                error: {
                    code: "NOT_FOUND",
                    message: `Revision not found: ${revisionId}`,
                },
            };
        }
        // A revision can outlive the cardinality it was written under, and another
        // entry can have claimed what it selected. Restoring makes its selection
        // live, so it answers to the relation's current limits exactly as a publish
        // does — checked before the restore, which on D1 cannot be undone.
        const stagedReferences = readStagedReferences(revision.data);
        if (stagedReferences) {
            const entry = await new ContentRepository(db).findById(revision.collection, revision.entryId);
            if (entry?.translationGroup) {
                const valid = await validateStagedReferences(db, revision.collection, stagedReferences, entry.translationGroup);
                if (!valid.success)
                    return valid;
            }
        }
        const restoredData = { ...revision.data };
        delete restoredData[STAGED_REFERENCES_BASELINE_KEY];
        const { item, revisionId: queuedRevisionId } = await new ContentRepository(db).restoreRevision(revision.collection, revision.entryId, restoredData, callerUserId);
        // Promoted only once the restore has landed, so a restore refused by its
        // fence leaves the live links untouched. The restore's own revision carries
        // the selection, so restoring it again retries a promotion that failed here.
        if (stagedReferences && item.translationGroup) {
            // Restoring a revision means replacing the current live selection with the
            // revision's selection, not merging a diff. The queued restored revision
            // also omits the old draft baseline so publishing it keeps this behavior.
            await applyStagedReferences(db, revision.collection, item.translationGroup, stagedReferences);
        }
        const pruneRepo = new RevisionRepository(db);
        after(async () => {
            try {
                await pruneRepo.pruneQueuedEntry(revision.collection, revision.entryId, queuedRevisionId, 50);
            }
            catch (error) {
                console.error(`[revisions] Failed to prune revisions for ${revision.collection}/${revision.entryId}:`, error);
            }
        });
        return {
            success: true,
            data: { item, _rev: encodeRev(item) },
        };
    }
    catch (error) {
        if (error instanceof ContentMutationConflictError) {
            return {
                success: false,
                error: { code: "CONFLICT", message: error.message },
            };
        }
        return {
            success: false,
            error: {
                code: "REVISION_RESTORE_ERROR",
                message: "Failed to restore revision",
            },
        };
    }
}
