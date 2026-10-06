/**
 * Schema/collection/field management APIs (Content Type Builder)
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse, throwResponseError } from "./client.js";
export async function fetchBlockTypes() {
    const response = await apiFetch(`${API_BASE}/schema/block-types`);
    const data = await parseApiResponse(response, "Failed to fetch block types");
    return data.items;
}
export async function fetchBlockType(slug) {
    const response = await apiFetch(`${API_BASE}/schema/block-types/${slug}`);
    const data = await parseApiResponse(response, "Failed to fetch block type");
    return data.item;
}
export async function createBlockType(input) {
    const response = await apiFetch(`${API_BASE}/schema/block-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const data = await parseApiResponse(response, "Failed to create block type");
    return data.item;
}
export async function updateBlockType(slug, input) {
    const response = await apiFetch(`${API_BASE}/schema/block-types/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const data = await parseApiResponse(response, "Failed to update block type");
    return data.item;
}
export async function activateBlockTypeVersion(slug, version, expectedFingerprint) {
    const response = await apiFetch(`${API_BASE}/schema/block-types/${slug}/versions/${version}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedFingerprint }),
    });
    const data = await parseApiResponse(response, "Failed to activate block type version");
    return data.item;
}
/**
 * Fetch all collections
 */
export async function fetchCollections() {
    const response = await apiFetch(`${API_BASE}/schema/collections`);
    const data = await parseApiResponse(response, "Failed to fetch collections");
    return data.items;
}
/**
 * Fetch a single collection with fields
 */
export async function fetchCollection(slug, includeFields = true) {
    const url = includeFields
        ? `${API_BASE}/schema/collections/${slug}?includeFields=true`
        : `${API_BASE}/schema/collections/${slug}`;
    const response = await apiFetch(url);
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Collection "${slug}" not found`);
        }
        await throwResponseError(response, i18n._(msg `Failed to fetch collection`));
    }
    const data = await parseApiResponse(response, i18n._(msg `Failed to fetch collection`));
    return data.item;
}
/**
 * Create a collection
 */
export async function createCollection(input) {
    const response = await apiFetch(`${API_BASE}/schema/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const data = await parseApiResponse(response, "Failed to create collection");
    return data.item;
}
/**
 * Update a collection
 */
export async function updateCollection(slug, input) {
    const response = await apiFetch(`${API_BASE}/schema/collections/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const data = await parseApiResponse(response, "Failed to update collection");
    return data.item;
}
/**
 * Delete a collection
 */
export async function deleteCollection(slug, force = false) {
    const url = force
        ? `${API_BASE}/schema/collections/${slug}?force=true`
        : `${API_BASE}/schema/collections/${slug}`;
    const response = await apiFetch(url, { method: "DELETE" });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete collection`));
}
/**
 * Fetch fields for a collection
 */
export async function fetchFields(collectionSlug) {
    const response = await apiFetch(`${API_BASE}/schema/collections/${collectionSlug}/fields`);
    const data = await parseApiResponse(response, "Failed to fetch fields");
    return data.items;
}
/**
 * Create a field
 */
export async function createField(collectionSlug, input) {
    const response = await apiFetch(`${API_BASE}/schema/collections/${collectionSlug}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const data = await parseApiResponse(response, "Failed to create field");
    return data.item;
}
/**
 * Update a field
 */
export async function updateField(collectionSlug, fieldSlug, input) {
    const response = await apiFetch(`${API_BASE}/schema/collections/${collectionSlug}/fields/${fieldSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const data = await parseApiResponse(response, "Failed to update field");
    return data.item;
}
/**
 * Delete a field
 */
export async function deleteField(collectionSlug, fieldSlug, options = {}) {
    const qs = options.deleteRelation ? "?deleteRelation=true" : "";
    const response = await apiFetch(`${API_BASE}/schema/collections/${collectionSlug}/fields/${fieldSlug}${qs}`, { method: "DELETE" });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete field`));
}
/**
 * Reorder fields
 */
export async function reorderFields(collectionSlug, fieldSlugs) {
    const response = await apiFetch(`${API_BASE}/schema/collections/${collectionSlug}/fields/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldSlugs }),
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to reorder fields`));
}
/**
 * Reorder collections in the admin sidebar.
 *
 * `slugs` is the full desired order — collections left out lose their
 * explicit position and fall back to alphabetical order after the ordered
 * ones.
 */
export async function reorderCollections(slugs) {
    const response = await apiFetch(`${API_BASE}/schema/collections/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs }),
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to reorder content types`));
}
/**
 * Fetch orphaned content tables
 */
export async function fetchOrphanedTables() {
    const response = await apiFetch(`${API_BASE}/schema/orphans`);
    const data = await parseApiResponse(response, "Failed to fetch orphaned tables");
    return data.items;
}
/**
 * Register an orphaned table as a collection
 */
export async function registerOrphanedTable(slug, options) {
    const response = await apiFetch(`${API_BASE}/schema/orphans/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options || {}),
    });
    const data = await parseApiResponse(response, "Failed to register orphaned table");
    return data.item;
}
