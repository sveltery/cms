/**
 * Comment Notification Emails
 *
 * Sends email notifications to content authors when comments are
 * approved on their content. Used by:
 *   - Public comment POST route (comment:afterCreate, if auto-approved)
 *   - Admin moderation route (comment:afterModerate, when approving)
 */
import { escapeHtml } from "../api/escape.js";
import { validateIdentifier } from "../database/validate.js";
const NOTIFICATION_SOURCE = "emdash-comments";
const MAX_EXCERPT_LENGTH = 500;
const CRLF_RE = /[\r\n]/g;
/**
 * Build an email notification for a new comment.
 */
export function buildCommentNotificationEmail(to, data) {
    const title = data.contentTitle || `${data.collection} item`;
    const subject = `New comment on "${title}"`.replace(CRLF_RE, " ");
    const excerpt = data.commentBody.length > MAX_EXCERPT_LENGTH
        ? data.commentBody.slice(0, MAX_EXCERPT_LENGTH) + "..."
        : data.commentBody;
    const adminUrl = `${data.adminBaseUrl}/admin/comments`;
    const text = [
        `${data.commentAuthorName} commented on "${title}":`,
        "",
        excerpt,
        "",
        `View in admin: ${adminUrl}`,
    ].join("\n");
    const html = [
        `<p><strong>${escapeHtml(data.commentAuthorName)}</strong> commented on &ldquo;${escapeHtml(title)}&rdquo;:</p>`,
        `<blockquote style="border-left:3px solid #ccc;padding-left:12px;margin:12px 0;color:#555">${escapeHtml(excerpt)}</blockquote>`,
        `<p><a href="${escapeHtml(adminUrl)}">View in admin</a></p>`,
    ].join("\n");
    return { to, subject, text, html };
}
/**
 * Send a comment notification to the content author if all conditions are met:
 * 1. Comment status is "approved"
 * 2. Content author exists and has an email
 * 3. Email provider is configured
 * 4. Commenter is not the content author (no self-notifications)
 *
 * Returns true if the email was sent, false if skipped.
 */
export async function sendCommentNotification(params) {
    const { email, comment, contentAuthor, adminBaseUrl } = params;
    if (comment.status !== "approved")
        return false;
    if (!contentAuthor?.email)
        return false;
    if (!email.isAvailable())
        return false;
    if (comment.authorEmail.toLowerCase() === contentAuthor.email.toLowerCase())
        return false;
    const message = buildCommentNotificationEmail(contentAuthor.email, {
        commentAuthorName: comment.authorName,
        commentBody: comment.body,
        contentTitle: params.contentTitle || "",
        collection: comment.collection,
        adminBaseUrl,
    });
    await email.send(message, NOTIFICATION_SOURCE);
    return true;
}
/**
 * Look up a content item's author from the database.
 *
 * Used by the admin moderation route where content info isn't
 * readily available (only the comment record is at hand).
 */
export async function lookupContentAuthor(db, collection, contentId) {
    validateIdentifier(collection, "collection");
    const contentRow = await db
        .selectFrom(`ec_${collection}`)
        .select(["slug", "author_id"])
        .where("id", "=", contentId)
        .executeTakeFirst();
    if (!contentRow)
        return null;
    const typed = contentRow;
    let author;
    if (typed.author_id) {
        const userRow = await db
            .selectFrom("users")
            .select(["id", "name", "email", "email_verified"])
            .where("id", "=", typed.author_id)
            .executeTakeFirst();
        if (userRow && userRow.email_verified) {
            author = { id: userRow.id, email: userRow.email, name: userRow.name };
        }
    }
    return { slug: typed.slug, author };
}
