/**
 * One-time approval grants that let an MCP caller without a transfer scope
 * start an export or import.
 *
 * Flow: the MCP tool creates a `pending` approval and fails with
 * `TRANSFER_APPROVAL_REQUIRED { approvalId }`; an admin approves it in a
 * session (never via MCP or a token); the MCP caller retries with the
 * approval id, and `consume` atomically turns an `approved`, unexpired grant
 * whose binding matches into `consumed`; `restore` hands it back if the
 * operation then fails to start. Each grant is bound to the user it is for,
 * the action, and every digest it was created with.
 */
import { ulid } from "ulidx";
import { TRANSFER_APPROVAL_ACTIONS } from "../auth.js";
import { TransferError } from "../errors.js";
import { isSha256Digest } from "../format/digest.js";
import { TRANSFER_LIMITS } from "../format/limits.js";
import { timestampIsDue, timestampIsLive, timestampNow, timestampOffset } from "./time.js";
export const APPROVAL_STATUSES = ["pending", "approved", "denied", "consumed", "expired"];
const STATUS_SET = new Set(APPROVAL_STATUSES);
const ACTION_SET = new Set(TRANSFER_APPROVAL_ACTIONS);
function isApprovalStatus(value) {
    return STATUS_SET.has(value);
}
function isApprovalAction(value) {
    return ACTION_SET.has(value);
}
function toApproval(row) {
    const { status, action } = row;
    if (!isApprovalStatus(status) || !isApprovalAction(action)) {
        throw new TransferError("TRANSFER_APPROVAL_INVALID", "Unknown approval status or action");
    }
    return {
        id: row.id,
        status,
        action,
        userId: row.user_id,
        requestedByTokenId: row.requested_by_token_id,
        approvedBy: row.approved_by,
        operationId: row.operation_id,
        paramsDigest: isSha256Digest(row.params_digest) ? row.params_digest : null,
        packageDigest: isSha256Digest(row.package_digest) ? row.package_digest : null,
        planDigest: isSha256Digest(row.plan_digest) ? row.plan_digest : null,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        decidedAt: row.decided_at,
        consumedAt: row.consumed_at,
    };
}
/** Every column a grant binds besides user and action, with the value it must hold (undefined = NULL). */
function boundColumns(binding) {
    return [
        ["operation_id", binding.operationId],
        ["params_digest", binding.paramsDigest],
        ["package_digest", binding.packageDigest],
        ["plan_digest", binding.planDigest],
        ["requested_by_token_id", binding.tokenId],
    ];
}
function invalid() {
    return new TransferError("TRANSFER_APPROVAL_INVALID", "Approval is missing, expired, or does not match");
}
export class TransferApprovalRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createPending(input) {
        if (input.action === "import" && (!input.packageDigest || !input.planDigest)) {
            throw new TransferError("TRANSFER_APPROVAL_INVALID", "An import approval must bind a package digest and a plan digest");
        }
        const row = await this.db
            .insertInto("_emdash_transfer_approvals")
            .values({
            id: ulid(),
            status: "pending",
            action: input.action,
            user_id: input.userId,
            requested_by_token_id: input.requestedByTokenId ?? null,
            approved_by: null,
            operation_id: input.operationId ?? null,
            params_digest: input.paramsDigest ?? null,
            package_digest: input.packageDigest ?? null,
            plan_digest: input.planDigest ?? null,
            expires_at: timestampOffset(this.db, input.ttlSeconds ?? TRANSFER_LIMITS.approvalTtlSeconds),
            decided_at: null,
            consumed_at: null,
        })
            .returningAll()
            .executeTakeFirstOrThrow();
        return toApproval(row);
    }
    async get(id) {
        const row = await this.db
            .selectFrom("_emdash_transfer_approvals")
            .selectAll()
            .where("id", "=", id)
            .executeTakeFirst();
        return row ? toApproval(row) : null;
    }
    /**
     * Approve a pending, unexpired grant. The grant then stays usable for the
     * approval TTL from now.
     */
    async approve(id, approvedBy, options = {}) {
        return this.decide(id, "approved", approvedBy, options.ttlSeconds);
    }
    async deny(id, deniedBy) {
        return this.decide(id, "denied", deniedBy);
    }
    async decide(id, status, decidedBy, ttlSeconds) {
        const now = timestampNow(this.db);
        const row = await this.db
            .updateTable("_emdash_transfer_approvals")
            .set({
            status,
            approved_by: decidedBy,
            decided_at: now,
            ...(status === "approved"
                ? {
                    expires_at: timestampOffset(this.db, ttlSeconds ?? TRANSFER_LIMITS.approvalTtlSeconds),
                }
                : {}),
        })
            .where("id", "=", id)
            .where("status", "=", "pending")
            .where(timestampIsLive(this.db, "expires_at"))
            .returningAll()
            .executeTakeFirst();
        if (!row)
            throw invalid();
        return toApproval(row);
    }
    /**
     * Consume an approved grant in one statement. Every digest or operation id
     * the grant was created with must be supplied and equal; a grant created
     * without one must be consumed without it. The same holds for the token:
     * a grant requested by token `T` can only be consumed by a caller
     * authenticated with `T` (pass `tokenId`), and a grant requested without a
     * token only by a caller without one. Throws `TRANSFER_APPROVAL_INVALID`
     * otherwise.
     */
    async consume(id, binding) {
        const now = timestampNow(this.db);
        let query = this.db
            .updateTable("_emdash_transfer_approvals")
            .set({ status: "consumed", consumed_at: now })
            .where("id", "=", id)
            .where("status", "=", "approved")
            .where(timestampIsLive(this.db, "expires_at"))
            .where("user_id", "=", binding.userId)
            .where("action", "=", binding.action);
        for (const [column, value] of boundColumns(binding)) {
            query =
                value === undefined ? query.where(column, "is", null) : query.where(column, "=", value);
        }
        const row = await query.returningAll().executeTakeFirst();
        if (!row)
            throw invalid();
        return toApproval(row);
    }
    /**
     * Return a grant `consume` took back to `approved`, for when the
     * operation it was consumed for could not be started. Its expiry is
     * unchanged, so an expired grant stays unusable.
     */
    async restore(id) {
        await this.db
            .updateTable("_emdash_transfer_approvals")
            .set({ status: "approved", consumed_at: null })
            .where("id", "=", id)
            .where("status", "=", "consumed")
            .execute();
    }
    /**
     * The newest pending, unexpired grant with exactly this binding, so a
     * caller retrying without an approval id reuses its open request instead
     * of adding another one for an admin to review.
     */
    async findPending(binding) {
        let query = this.db
            .selectFrom("_emdash_transfer_approvals")
            .selectAll()
            .where("status", "=", "pending")
            .where(timestampIsLive(this.db, "expires_at"))
            .where("user_id", "=", binding.userId)
            .where("action", "=", binding.action);
        for (const [column, value] of boundColumns(binding)) {
            query =
                value === undefined ? query.where(column, "is", null) : query.where(column, "=", value);
        }
        const row = await query.orderBy("created_at", "desc").orderBy("id", "desc").executeTakeFirst();
        return row ? toApproval(row) : null;
    }
    /**
     * Whether a grant for `action` on `operationId` was consumed by this user
     * authenticated with this token (or, without `tokenId`, without a token).
     */
    async hasConsumed(binding) {
        let query = this.db
            .selectFrom("_emdash_transfer_approvals")
            .select("id")
            .where("status", "=", "consumed")
            .where("user_id", "=", binding.userId)
            .where("action", "=", binding.action)
            .where("operation_id", "=", binding.operationId);
        query =
            binding.tokenId === undefined
                ? query.where("requested_by_token_id", "is", null)
                : query.where("requested_by_token_id", "=", binding.tokenId);
        return (await query.executeTakeFirst()) !== undefined;
    }
    /**
     * Record the operation a consumed export grant created. Export grants are
     * requested before the operation exists, so they bind no operation id
     * until they are used.
     */
    async linkOperation(id, operationId) {
        await this.db
            .updateTable("_emdash_transfer_approvals")
            .set({ operation_id: operationId })
            .where("id", "=", id)
            .where("status", "=", "consumed")
            .where("action", "=", "export")
            .where("operation_id", "is", null)
            .execute();
    }
    /** Approvals newest first. */
    async list(options = {}) {
        const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
        let query = this.db.selectFrom("_emdash_transfer_approvals").selectAll();
        if (options.userId)
            query = query.where("user_id", "=", options.userId);
        if (options.status)
            query = query.where("status", "=", options.status);
        const cursor = options.cursor;
        if (cursor) {
            query = query.where((eb) => eb.or([
                eb("created_at", "<", cursor.createdAt),
                eb.and([eb("created_at", "=", cursor.createdAt), eb("id", "<", cursor.id)]),
            ]));
        }
        const rows = await query
            .orderBy("created_at", "desc")
            .orderBy("id", "desc")
            .limit(limit + 1)
            .execute();
        const items = rows.slice(0, limit).map(toApproval);
        const last = items.at(-1);
        return rows.length > limit && last
            ? { items, next: { createdAt: last.createdAt, id: last.id } }
            : { items };
    }
    /** Mark pending and approved grants past their expiry as `expired`; returns how many. */
    async expireDue() {
        const result = await this.db
            .updateTable("_emdash_transfer_approvals")
            .set({ status: "expired" })
            .where("status", "in", ["pending", "approved"])
            .where(timestampIsDue(this.db, "expires_at"))
            .executeTakeFirst();
        return Number(result.numUpdatedRows ?? 0n);
    }
}
