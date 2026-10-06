/**
 * Unified site write fence: media-usage activation and transfer imports.
 *
 * One query answers both questions, so a fenced write path pays a single
 * round trip. A transfer import fences writes while it executes and, after a
 * failure or cancellation once writing started, until it is abandoned. The
 * same query reports whether an export is running, so a fenced write can
 * bump the export's write epoch without an extra query when none is.
 */
import { sql } from "kysely";
import { apiError } from "../api/error.js";
import { findMediaUsageActivationWriteFenceError } from "../api/media-usage-write-fence.js";
import { isMissingTableError } from "../utils/db-errors.js";
export class SiteWriteBlockedError extends Error {
    code;
    status;
    operationId;
    constructor(error) {
        super(error.message);
        this.name = error.code;
        this.code = error.code;
        this.status = error.status;
        this.operationId = error.operationId;
    }
}
const CHECK_FAILED = {
    code: "TRANSFER_FENCE_CHECK_FAILED",
    message: "Unable to verify whether site writes are allowed",
    status: 503,
};
/** Read both fences and the running-export flag with one query. */
export async function readSiteWriteFence(db, scope = {}) {
    const mediaUsage = scope.mediaUsage !== false;
    const transfer = scope.transfer !== false;
    let row;
    try {
        const result = await sql `
			SELECT
				(
					SELECT state FROM _emdash_media_usage_activation
					WHERE task_key = 'incremental_capture'
				) AS media_state,
				(
					SELECT id FROM _emdash_transfer_operations
					WHERE kind = 'import'
						AND (
							state IN ('running', 'verifying')
							OR (state IN ('failed', 'cancelled') AND mutation_started_at IS NOT NULL)
						)
					LIMIT 1
				) AS import_id,
				(
					SELECT id FROM _emdash_transfer_operations
					WHERE kind = 'export' AND state = 'running'
					LIMIT 1
				) AS export_id
		`.execute(db);
        row = result.rows[0];
    }
    catch (error) {
        if (isMissingTableError(error)) {
            return {
                error: mediaUsage ? await findMediaUsageActivationWriteFenceError(db) : null,
                exportRunning: false,
            };
        }
        console.error("[transfer] Failed to check the site write fence:", error);
        return { error: CHECK_FAILED, exportRunning: false };
    }
    const exportRunning = Boolean(row?.export_id);
    if (transfer && row?.import_id) {
        return {
            error: {
                code: "TRANSFER_IMPORT_IN_PROGRESS",
                message: "A site import is in progress or incomplete; writes are disabled",
                status: 503,
                operationId: row.import_id,
            },
            exportRunning,
        };
    }
    if (mediaUsage && row?.media_state === "activating") {
        return {
            error: {
                code: "MEDIA_USAGE_ACTIVATION_IN_PROGRESS",
                message: "Media usage activation is in progress",
                status: 503,
            },
            exportRunning,
        };
    }
    return { error: null, exportRunning };
}
export async function findSiteWriteFenceError(db) {
    return (await readSiteWriteFence(db)).error;
}
/**
 * Tell running exports that a fenced write happened, so their consistency
 * fence restarts them. Failures are logged, not thrown: the write itself is
 * allowed either way.
 */
export async function recordSiteWrite(db) {
    try {
        await bumpRunningExportWriteEpochs(db);
    }
    catch (error) {
        console.error("[transfer] Failed to record a write for running exports:", error);
    }
}
/** Increments the write epoch of every running export; returns how many there were. */
export async function bumpRunningExportWriteEpochs(db) {
    const result = await db
        .updateTable("_emdash_transfer_operations")
        .set({ write_epoch: sql `write_epoch + 1` })
        .where("kind", "=", "export")
        .where("state", "=", "running")
        .executeTakeFirst();
    return Number(result.numUpdatedRows ?? 0n);
}
const NOTHING_TO_RECORD = async () => { };
/**
 * Throw {@link SiteWriteBlockedError} when a fence blocks writes. Call it
 * immediately before the write, and call the returned function once the
 * write has succeeded: recording it afterwards means an export whose fence
 * was captured while the write ran still sees it.
 */
export async function assertSiteWriteAllowed(db) {
    const status = await readSiteWriteFence(db);
    if (status.error)
        throw new SiteWriteBlockedError(status.error);
    return status.exportRunning ? () => recordSiteWrite(db) : NOTHING_TO_RECORD;
}
/**
 * The fence as an API error response, or null when writes are allowed.
 * Records nothing: for the plugin lifecycle routes that call it, the fence
 * middleware records a successful response's write.
 */
export async function checkSiteWriteFence(db) {
    const status = await readSiteWriteFence(db);
    if (status.error)
        return apiError(status.error.code, status.error.message, status.error.status);
    return null;
}
