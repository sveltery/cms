/**
 * Transfer operation states, stages, and typed cursors.
 *
 * Export:  pending → running → complete | failed | expired
 * Import:  uploading → analyzing → planned → running → verifying
 *          → complete | failed | cancelled | abandoned | expired
 *
 * An import "occupies" the target from creation until it reaches a terminal
 * state. A failed or cancelled import that already started writing
 * (`mutation_started_at` set) keeps occupying the target, and keeps site
 * writes fenced, until it is explicitly abandoned. The partial unique index
 * `idx__emdash_transfer_operations_active_import` (migration 084) enforces
 * one occupying import per target with the same predicate as
 * {@link isOccupyingImport}.
 */
import { z } from "zod";
import { RECORD_KINDS } from "../format/kinds.js";
export const TRANSFER_RUNTIME_GENERATION = 1;
export const TRANSFER_OPERATION_KINDS = ["export", "import"];
export const EXPORT_STATES = ["pending", "running", "complete", "failed", "expired"];
export const IMPORT_STATES = [
    "uploading",
    "analyzing",
    "planned",
    "running",
    "verifying",
    "complete",
    "failed",
    "cancelled",
    "abandoned",
    "expired",
];
const OPERATION_KINDS = new Set(TRANSFER_OPERATION_KINDS);
const OPERATION_STATES = new Set([...EXPORT_STATES, ...IMPORT_STATES]);
export function isTransferOperationKind(value) {
    return OPERATION_KINDS.has(value);
}
export function isTransferOperationState(value) {
    return OPERATION_STATES.has(value);
}
/** Import states before execution starts; they expire after the pending TTL. */
export const PRE_EXECUTION_IMPORT_STATES = ["uploading", "analyzing", "planned"];
/** Import states in which the importer is writing to the target. */
export const EXECUTING_IMPORT_STATES = ["running", "verifying"];
export const TERMINAL_EXPORT_STATES = ["complete", "failed", "expired"];
export const TERMINAL_IMPORT_STATES = [
    "complete",
    "failed",
    "cancelled",
    "abandoned",
    "expired",
];
export function isTerminalState(kind, state) {
    return kind === "export"
        ? TERMINAL_EXPORT_STATES.includes(state)
        : TERMINAL_IMPORT_STATES.includes(state);
}
/** Whether an import occupies the target (see the module comment). */
export function isOccupyingImport(state, mutationStarted) {
    if (PRE_EXECUTION_IMPORT_STATES.includes(state))
        return true;
    if (EXECUTING_IMPORT_STATES.includes(state))
        return true;
    return (state === "failed" || state === "cancelled") && mutationStarted;
}
/** Whether an import fences site writes: executing, or incomplete after writing started. */
export function isWriteFencingImport(state, mutationStarted) {
    if (EXECUTING_IMPORT_STATES.includes(state))
        return true;
    return (state === "failed" || state === "cancelled") && mutationStarted;
}
// ── Stages ──────────────────────────────────────────────────────
export const EXPORT_STAGES = [
    "export_records",
    "export_media",
    "export_finalize",
    "export_validate",
];
export const ANALYSIS_STAGES = [
    "analyze_structure",
    "analyze_records",
    "analyze_references",
    "analyze_target",
];
/**
 * Import stages in execution order. The record stages write the kinds listed
 * in `IMPORT_STAGE_KINDS` (format/kinds.ts).
 */
export const IMPORT_STAGES = [
    "reserve",
    "clear_scaffold",
    "schema",
    "media",
    "terms_bylines",
    "content",
    "relations",
    "presentation",
    "rebuild",
    "verify",
];
export const REBUILD_STEPS = ["search", "media_usage", "options", "taxonomies", "caches"];
// ── Cursors ─────────────────────────────────────────────────────
const recordKindSchema = z.enum(RECORD_KINDS);
const nonNegativeInt = z.number().int().nonnegative();
/** Next record to process in a package stream: chunk `seq`, zero-based `line`. */
export const streamPositionSchema = z.strictObject({
    kind: recordKindSchema,
    seq: nonNegativeInt,
    line: nonNegativeInt,
});
/** Last stream-order key processed (`depth` only for topological kinds). */
export const streamKeySchema = z.strictObject({
    id: z.string(),
    depth: nonNegativeInt.optional(),
});
/**
 * Optimistic-read fence captured before an export attempt and re-checked
 * after it. `writeEpoch` is the export operation's `write_epoch` column,
 * which fenced writes bump while the export runs.
 */
export const exportFenceSchema = z.strictObject({
    writeEpoch: nonNegativeInt,
    tables: z.array(z.strictObject({
        table: z.string(),
        count: nonNegativeInt,
        maxChanged: z.string().optional(),
        maxId: z.string().optional(),
    })),
});
const exportAttempt = z.number().int().min(1);
export const exportCursorSchema = z.discriminatedUnion("stage", [
    z.strictObject({
        stage: z.literal("export_records"),
        attempt: exportAttempt,
        fence: exportFenceSchema,
        kind: recordKindSchema,
        /** For `entry`, the collection slug being read. */
        collection: z.string().optional(),
        after: streamKeySchema.nullable(),
        nextSeq: nonNegativeInt,
        /** Exporter-owned running totals (see `transfer/export`). */
        summary: z.json().optional(),
    }),
    z.strictObject({
        stage: z.literal("export_media"),
        attempt: exportAttempt,
        fence: exportFenceSchema,
        afterMediaId: z.string().nullable(),
        summary: z.json().optional(),
    }),
    z.strictObject({
        stage: z.literal("export_finalize"),
        attempt: exportAttempt,
        fence: exportFenceSchema,
        nextIndexSeq: nonNegativeInt,
        afterPath: z.string().nullable(),
        summary: z.json().optional(),
    }),
    z.strictObject({
        stage: z.literal("export_validate"),
        position: streamPositionSchema.nullable(),
        /** Exporter-owned validation progress (see `transfer/export`). */
        validation: z.json().optional(),
    }),
]);
export const analysisCursorSchema = z.discriminatedUnion("stage", [
    z.strictObject({ stage: z.literal("analyze_structure"), nextIndexSeq: nonNegativeInt }),
    z.strictObject({ stage: z.literal("analyze_records"), position: streamPositionSchema }),
    z.strictObject({
        stage: z.literal("analyze_references"),
        check: nonNegativeInt,
        after: z.string().nullable(),
    }),
    z.strictObject({ stage: z.literal("analyze_target") }),
]);
const recordStage = (stage) => z.strictObject({ stage: z.literal(stage), position: streamPositionSchema });
export const importCursorSchema = z.discriminatedUnion("stage", [
    z.strictObject({ stage: z.literal("reserve") }),
    z.strictObject({ stage: z.literal("clear_scaffold"), step: nonNegativeInt }),
    recordStage("schema"),
    recordStage("media"),
    recordStage("terms_bylines"),
    recordStage("content"),
    recordStage("relations"),
    recordStage("presentation"),
    z.strictObject({
        stage: z.literal("rebuild"),
        step: z.enum(REBUILD_STEPS),
        after: z.string().nullable(),
    }),
    z.strictObject({
        stage: z.literal("verify"),
        position: streamPositionSchema.nullable(),
        mediaAfter: z.string().nullable(),
        mismatches: nonNegativeInt,
        /** The verifier's own resumable state, stored as given. */
        verifier: z.json().optional(),
    }),
]);
export const transferCursorSchema = z.union([
    exportCursorSchema,
    analysisCursorSchema,
    importCursorSchema,
]);
/**
 * Bounded progress summary shown by status endpoints. `done` of `total`
 * counts stages (and, for an export, record kinds). `records` is the number
 * of records an export has written so far; the byte counts cover package
 * files once they are known.
 */
export const transferProgressSchema = z.strictObject({
    done: nonNegativeInt,
    total: nonNegativeInt,
    records: nonNegativeInt.optional(),
    bytesDone: nonNegativeInt.optional(),
    bytesTotal: nonNegativeInt.optional(),
});
