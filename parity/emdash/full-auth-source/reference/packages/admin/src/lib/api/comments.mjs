/**
 * Comment moderation API client
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse, throwResponseError, } from "./client.js";
// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
/**
 * Fetch comments for the moderation inbox
 */
export async function fetchComments(options) {
    const params = new URLSearchParams();
    if (options?.status)
        params.set("status", options.status);
    if (options?.collection)
        params.set("collection", options.collection);
    if (options?.search)
        params.set("search", options.search);
    if (options?.limit)
        params.set("limit", String(options.limit));
    if (options?.cursor)
        params.set("cursor", options.cursor);
    const url = `${API_BASE}/admin/comments${params.toString() ? `?${params}` : ""}`;
    const response = await apiFetch(url);
    return parseApiResponse(response, "Failed to fetch comments");
}
/**
 * Fetch comment status counts for inbox badges
 */
export async function fetchCommentCounts() {
    const response = await apiFetch(`${API_BASE}/admin/comments/counts`);
    return parseApiResponse(response, "Failed to fetch comment counts");
}
/**
 * Fetch a single comment by ID
 */
export async function fetchComment(id) {
    const response = await apiFetch(`${API_BASE}/admin/comments/${id}`);
    return parseApiResponse(response, "Failed to fetch comment");
}
// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
/**
 * Update a comment's status
 */
export async function updateCommentStatus(id, status) {
    const response = await apiFetch(`${API_BASE}/admin/comments/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
    });
    return parseApiResponse(response, "Failed to update comment status");
}
/**
 * Hard delete a comment (ADMIN only)
 */
export async function deleteComment(id) {
    const response = await apiFetch(`${API_BASE}/admin/comments/${id}`, {
        method: "DELETE",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete comment`));
}
/**
 * Bulk status change or delete
 */
export async function bulkCommentAction(ids, action) {
    const response = await apiFetch(`${API_BASE}/admin/comments/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
    });
    return parseApiResponse(response, "Failed to perform bulk action");
}
