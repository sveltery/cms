/**
 * Content CRUD and revision APIs
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse, throwResponseError, } from "./client.js";
/**
 * Derive draft status from a content item's revision pointers
 */
export function getDraftStatus(item) {
    if (!item.liveRevisionId)
        return "unpublished";
    if (item.draftRevisionId && item.draftRevisionId !== item.liveRevisionId)
        return "published_with_changes";
    return "published";
}
/**
 * Fetch translations for a content item
 */
export async function fetchTranslations(collection, id) {
    const response = await apiFetch(`${API_BASE}/content/${collection}/${id}/translations`);
    return parseApiResponse(response, "Failed to fetch translations");
}
export async function fetchContentList(collection, options) {
    const params = new URLSearchParams();
    if (options?.cursor)
        params.set("cursor", options.cursor);
    if (options?.limit)
        params.set("limit", String(options.limit));
    if (options?.status)
        params.set("status", options.status);
    if (options?.locale)
        params.set("locale", options.locale);
    if (options?.orderBy)
        params.set("orderBy", options.orderBy);
    if (options?.order)
        params.set("order", options.order);
    if (options?.search)
        params.set("q", options.search);
    if (options?.authorId)
        params.set("authorId", options.authorId);
    // A date range is only meaningful with a target field; send all three
    // together so the server doesn't reject a half-specified filter.
    if (options?.dateField && (options.dateFrom || options.dateTo)) {
        params.set("dateField", options.dateField);
        if (options.dateFrom)
            params.set("dateFrom", options.dateFrom);
        if (options.dateTo)
            params.set("dateTo", options.dateTo);
    }
    // `none` is the server's sentinel for "no byline assigned"; it takes
    // precedence over a stale selection so the two can't be sent together.
    if (options?.bylinesNone) {
        params.set("bylines", "none");
    }
    else if (options?.bylines && options.bylines.length > 0) {
        params.set("bylines", options.bylines.join(","));
    }
    if (options?.includeInferredBylines && (options.bylinesNone || options.bylines?.length)) {
        params.set("includeInferredBylines", "1");
    }
    const url = `${API_BASE}/content/${collection}${params.toString() ? `?${params}` : ""}`;
    const response = await apiFetch(url);
    return parseApiResponse(response, "Failed to fetch content");
}
/**
 * Fetch the distinct authors of a collection's content. Gated on
 * `content:read`, so unlike the user-management API it's available to any
 * editor. Returns only users who have authored at least one live entry.
 */
export async function fetchContentAuthors(collection) {
    const response = await apiFetch(`${API_BASE}/content/${collection}/authors`);
    const data = await parseApiResponse(response, "Failed to fetch content authors");
    return data.items;
}
/**
 * Fetch single content item
 */
export async function fetchContent(collection, id, options) {
    const params = new URLSearchParams();
    if (options?.locale)
        params.set("locale", options.locale);
    const query = params.toString() ? `?${params}` : "";
    const response = await apiFetch(`${API_BASE}/content/${collection}/${id}${query}`);
    const data = await parseApiResponse(response, "Failed to fetch content");
    // The server returns `_rev` at the envelope level, not inside `item`.
    // Lift it onto the item so the editor can echo it back on save (#2121).
    return { ...data.item, _rev: data._rev };
}
/**
 * Create content
 */
export async function createContent(collection, input) {
    const response = await apiFetch(`${API_BASE}/content/${collection}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            data: input.data,
            slug: input.slug,
            status: input.status,
            bylines: input.bylines,
            locale: input.locale,
            translationOf: input.translationOf,
            references: input.references,
        }),
    });
    const data = await parseApiResponse(response, "Failed to create content");
    return { ...data.item, _rev: data._rev };
}
/**
 * Update content
 */
export async function updateContent(collection, id, input, options) {
    const params = new URLSearchParams();
    if (options?.locale)
        params.set("locale", options.locale);
    const query = params.toString() ? `?${params}` : "";
    const response = await apiFetch(`${API_BASE}/content/${collection}/${id}${query}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const data = await parseApiResponse(response, "Failed to update content");
    return { ...data.item, _rev: data._rev };
}
/**
 * Delete content (moves to trash)
 */
export async function deleteContent(collection, id, options) {
    const params = new URLSearchParams();
    if (options?.locale)
        params.set("locale", options.locale);
    const query = params.toString() ? `?${params}` : "";
    const response = await apiFetch(`${API_BASE}/content/${collection}/${id}${query}`, {
        method: "DELETE",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete content`));
}
/**
 * Fetch trashed content list
 */
export async function fetchTrashedContent(collection, options) {
    const params = new URLSearchParams();
    if (options?.cursor)
        params.set("cursor", options.cursor);
    if (options?.limit)
        params.set("limit", String(options.limit));
    if (options?.locale)
        params.set("locale", options.locale);
    const url = `${API_BASE}/content/${collection}/trash${params.toString() ? `?${params}` : ""}`;
    const response = await apiFetch(url);
    return parseApiResponse(response, "Failed to fetch trashed content");
}
/**
 * Restore content from trash
 */
export async function restoreContent(collection, id) {
    const response = await apiFetch(`${API_BASE}/content/${collection}/${id}/restore`, {
        method: "POST",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to restore content`));
}
/**
 * Permanently delete content (cannot be undone)
 */
export async function permanentDeleteContent(collection, id) {
    const response = await apiFetch(`${API_BASE}/content/${collection}/${id}/permanent`, {
        method: "DELETE",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to permanently delete content`));
}
/**
 * Duplicate content (creates a draft copy)
 */
export async function duplicateContent(collection, id) {
    const response = await apiFetch(`${API_BASE}/content/${collection}/${id}/duplicate`, {
        method: "POST",
    });
    const data = await parseApiResponse(response, "Failed to duplicate content");
    return data.item;
}
/**
 * Schedule content for future publishing
 */
export async function scheduleContent(collection, id, scheduledAt, options) {
    const params = new URLSearchParams();
    if (options?.locale)
        params.set("locale", options.locale);
    const query = params.toString() ? `?${params}` : "";
    const response = await apiFetch(`${API_BASE}/content/${collection}/${id}/schedule${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt }),
    });
    const data = await parseApiResponse(response, "Failed to schedule content");
    return { ...data.item, _rev: data._rev };
}
/**
 * Unschedule content (revert to draft)
 */
export async function unscheduleContent(collection, id, options) {
    const params = new URLSearchParams();
    if (options?.locale)
        params.set("locale", options.locale);
    const query = params.toString() ? `?${params}` : "";
    const response = await apiFetch(`${API_BASE}/content/${collection}/${id}/schedule${query}`, {
        method: "DELETE",
    });
    const data = await parseApiResponse(response, "Failed to unschedule content");
    return { ...data.item, _rev: data._rev };
}
/**
 * Get a preview URL for content
 *
 * Returns a signed URL that allows viewing draft content.
 * Returns null if the EmDash runtime isn't initialized on the server
 * (responds with NOT_CONFIGURED). The preview secret itself no longer
 * needs to be set explicitly — it auto-generates on first use.
 */
export async function getPreviewUrl(collection, id, options) {
    try {
        const response = await apiFetch(`${API_BASE}/content/${collection}/${id}/preview-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(options || {}),
        });
        if (response.status === 500) {
            // Preview not configured — check error code without consuming body for parseApiResponse
            const body = await response.json().catch(() => ({}));
            if (typeof body === "object" &&
                body !== null &&
                "error" in body &&
                typeof body.error === "object" &&
                body.error !== null &&
                "code" in body.error &&
                body.error.code === "NOT_CONFIGURED") {
                return null;
            }
            // Some other 500 error
            throw new Error("Failed to get preview URL");
        }
        return parseApiResponse(response, "Failed to get preview URL");
    }
    catch {
        // If preview endpoint doesn't exist or fails, return null
        return null;
    }
}
// =============================================================================
// Publishing (Draft Revisions)
// =============================================================================
/**
 * Publish content - promotes current draft to live
 */
export async function publishContent(collection, id, options) {
    const params = new URLSearchParams();
    if (options?.locale)
        params.set("locale", options.locale);
    const query = params.toString() ? `?${params}` : "";
    const response = await apiFetch(`${API_BASE}/content/${collection}/${id}/publish${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _rev: options?._rev }),
    });
    const data = await parseApiResponse(response, "Failed to publish content");
    return { ...data.item, _rev: data._rev };
}
/**
 * Unpublish content - removes from public, preserves draft
 */
export async function unpublishContent(collection, id, options) {
    const params = new URLSearchParams();
    if (options?.locale)
        params.set("locale", options.locale);
    const query = params.toString() ? `?${params}` : "";
    const response = await apiFetch(`${API_BASE}/content/${collection}/${id}/unpublish${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _rev: options?._rev }),
    });
    const data = await parseApiResponse(response, "Failed to unpublish content");
    return { ...data.item, _rev: data._rev };
}
/**
 * Discard draft changes - reverts to live version
 */
export async function discardDraft(collection, id, options) {
    const params = new URLSearchParams();
    if (options?.locale)
        params.set("locale", options.locale);
    const query = params.toString() ? `?${params}` : "";
    const response = await apiFetch(`${API_BASE}/content/${collection}/${id}/discard-draft${query}`, {
        method: "POST",
    });
    const data = await parseApiResponse(response, "Failed to discard draft");
    return { ...data.item, _rev: data._rev };
}
/**
 * Compare live and draft revisions
 */
export async function compareRevisions(collection, id) {
    const response = await apiFetch(`${API_BASE}/content/${collection}/${id}/compare`);
    return parseApiResponse(response, "Failed to compare revisions");
}
/**
 * Fetch revisions for a content item
 */
export async function fetchRevisions(collection, entryId, options) {
    const params = new URLSearchParams();
    if (options?.limit)
        params.set("limit", String(options.limit));
    const url = `${API_BASE}/content/${collection}/${entryId}/revisions${params.toString() ? `?${params}` : ""}`;
    const response = await apiFetch(url);
    return parseApiResponse(response, "Failed to fetch revisions");
}
/**
 * Get a specific revision
 */
export async function fetchRevision(revisionId) {
    const response = await apiFetch(`${API_BASE}/revisions/${revisionId}`);
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Revision not found: ${revisionId}`);
        }
        await throwResponseError(response, i18n._(msg `Failed to fetch revision`));
    }
    const data = await parseApiResponse(response, i18n._(msg `Failed to fetch revision`));
    return data.item;
}
/**
 * Restore a revision (updates content to this revision's data)
 */
export async function restoreRevision(revisionId) {
    const response = await apiFetch(`${API_BASE}/revisions/${revisionId}/restore`, {
        method: "POST",
    });
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Revision not found: ${revisionId}`);
        }
        await throwResponseError(response, i18n._(msg `Failed to restore revision`));
    }
    const data = await parseApiResponse(response, i18n._(msg `Failed to restore revision`));
    return { ...data.item, _rev: data._rev };
}
