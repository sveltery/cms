import { sql } from "kysely";
import { apiError, apiSuccess, handleError } from "../api/error.js";
import { hashIp } from "../api/handlers/comments.js";
import { isParseError, parseBody } from "../api/parse.js";
import { createCommentBody } from "../api/schemas/comments.js";
import { getSiteBaseUrl } from "../api/site-url.js";
import { checkRateLimit } from "../auth/rate-limit.js";
import { resolveSecretsCached } from "../config/secrets.js";
import { CommentRepository } from "../database/repositories/comment.js";
import { validateIdentifier } from "../database/validate.js";
import { extractRequestMeta } from "../plugins/request-meta.js";
import { sendCommentNotification } from "./notifications.js";
import { createComment } from "./service.js";
function parseCommentModeration(value) {
    if (value === "all" || value === "first_time" || value === "none")
        return value;
    return "all";
}
function isModerationDecision(value) {
    if (typeof value !== "object" || value === null || !("status" in value))
        return false;
    if (value.status !== "pending" && value.status !== "approved" && value.status !== "spam") {
        return false;
    }
    return !("reason" in value) || value.reason === undefined || typeof value.reason === "string";
}
export async function submitPublicComment(runtime, collection, contentId, request, user) {
    try {
        const body = await parseBody(request, createCommentBody);
        if (isParseError(body))
            return body;
        const collectionRow = await runtime.db
            .selectFrom("_emdash_collections")
            .select([
            "comments_enabled",
            "comments_moderation",
            "comments_closed_after_days",
            "comments_auto_approve_users",
        ])
            .where("slug", "=", collection)
            .executeTakeFirst();
        if (!collectionRow) {
            return apiError("NOT_FOUND", `Collection '${collection}' not found`, 404);
        }
        if (!collectionRow.comments_enabled) {
            return apiError("COMMENTS_DISABLED", "Comments are not enabled for this collection", 403);
        }
        validateIdentifier(collection, "collection");
        const contentResult = await sql `
			SELECT id, slug, author_id, published_at
			FROM ${sql.ref(`ec_${collection}`)}
			WHERE id = ${contentId}
			AND status = 'published'
			AND deleted_at IS NULL
		`.execute(runtime.db);
        const contentRow = contentResult.rows[0];
        if (!contentRow)
            return apiError("NOT_FOUND", "Content not found", 404);
        if (collectionRow.comments_closed_after_days > 0) {
            const publishedAt = contentRow.published_at;
            if (publishedAt) {
                const closedDate = new Date(publishedAt);
                closedDate.setDate(closedDate.getDate() + collectionRow.comments_closed_after_days);
                if (new Date() > closedDate) {
                    return apiError("COMMENTS_CLOSED", "Comments are closed for this content", 403);
                }
            }
        }
        if (body.website_url) {
            return apiSuccess({ status: "pending", message: "Comment submitted for review" });
        }
        const meta = extractRequestMeta(request, runtime.config);
        const { getTurnstileSecretKey, verifyTurnstileToken } = await import("./turnstile.js");
        const turnstileSecretKey = getTurnstileSecretKey();
        if (turnstileSecretKey &&
            !(await verifyTurnstileToken(body.turnstileToken, turnstileSecretKey, meta.ip))) {
            return apiError("TURNSTILE_FAILED", "CAPTCHA verification failed", 403);
        }
        // Counted after the CAPTCHA so unverified requests can't use up the
        // shared bucket for visitors without a trusted IP.
        const { ipSalt } = await resolveSecretsCached(runtime.db);
        const ipHash = meta.ip ? await hashIp(meta.ip, ipSalt) : "unknown";
        const rateLimit = await checkRateLimit(runtime.db, ipHash, "comments/submit", ipHash === "unknown" ? 20 : 5, 600);
        if (!rateLimit.allowed) {
            const response = apiError("RATE_LIMITED", "Too many comments. Please try again later.", 429);
            response.headers.set("Retry-After", "600");
            return response;
        }
        const settings = {
            commentsEnabled: true,
            commentsModeration: parseCommentModeration(collectionRow.comments_moderation),
            commentsClosedAfterDays: collectionRow.comments_closed_after_days,
            commentsAutoApproveUsers: collectionRow.comments_auto_approve_users === 1,
        };
        const authorName = user?.name || body.authorName;
        const authorEmail = user?.email ?? body.authorEmail;
        let resolvedParentId = body.parentId ?? null;
        if (body.parentId) {
            const parent = await new CommentRepository(runtime.db).findById(body.parentId);
            if (!parent)
                return apiError("VALIDATION_ERROR", "Parent comment not found", 400);
            if (parent.collection !== collection || parent.contentId !== contentId) {
                return apiError("VALIDATION_ERROR", "Parent comment belongs to different content", 400);
            }
            resolvedParentId = parent.parentId ?? parent.id;
        }
        let contentAuthor;
        if (contentRow.author_id) {
            const authorRow = await runtime.db
                .selectFrom("users")
                .select(["id", "name", "email", "email_verified"])
                .where("id", "=", contentRow.author_id)
                .executeTakeFirst();
            if (authorRow?.email_verified) {
                contentAuthor = { id: authorRow.id, name: authorRow.name, email: authorRow.email };
            }
        }
        const hookRunner = {
            runBeforeCreate: (event) => runtime.hooks.runCommentBeforeCreate(event),
            runModerate: async (event) => {
                const result = await runtime.hooks.invokeExclusiveHook("comment:moderate", event);
                if (!result)
                    return { status: "pending", reason: "No moderator configured" };
                if (result.error) {
                    console.error(`[comments] Moderation error (${result.pluginId}):`, result.error.message);
                    return { status: "pending", reason: "Moderation error" };
                }
                return isModerationDecision(result.result)
                    ? result.result
                    : { status: "pending", reason: "Invalid moderation result" };
            },
            fireAfterCreate: (event) => {
                void runtime.hooks
                    .runCommentAfterCreate(event)
                    .catch((error) => console.error("[comments] afterCreate error:", error instanceof Error ? error.message : error));
            },
            fireAfterModerate: (event) => {
                void runtime.hooks
                    .runCommentAfterModerate(event)
                    .catch((error) => console.error("[comments] afterModerate error:", error instanceof Error ? error.message : error));
            },
        };
        const result = await createComment(runtime.db, {
            collection,
            contentId,
            parentId: resolvedParentId,
            authorName,
            authorEmail,
            authorUserId: user?.id ?? null,
            body: body.body,
            ipHash,
            userAgent: meta.userAgent,
        }, settings, hookRunner, {
            id: contentRow.id,
            collection,
            slug: contentRow.slug,
            author: contentAuthor,
        });
        if (!result)
            return apiError("COMMENT_REJECTED", "Comment was rejected", 403);
        if (result.comment.status === "approved" && runtime.email && contentAuthor) {
            try {
                const adminBaseUrl = await getSiteBaseUrl(runtime.db, request, runtime.config);
                await sendCommentNotification({
                    email: runtime.email,
                    comment: result.comment,
                    contentAuthor,
                    adminBaseUrl,
                });
            }
            catch (error) {
                console.error("[comments] notification error:", error instanceof Error ? error.message : error);
            }
        }
        return apiSuccess({
            id: result.comment.id,
            status: result.comment.status,
            message: result.comment.status === "approved"
                ? "Comment published"
                : "Comment submitted for review",
        }, 201);
    }
    catch (error) {
        return handleError(error, "Failed to submit comment", "COMMENT_CREATE_ERROR");
    }
}
