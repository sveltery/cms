import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse, throwResponseError, } from "./client.js";
export async function fetchBylines(options) {
    const params = new URLSearchParams();
    if (options?.search)
        params.set("search", options.search);
    if (options?.isGuest !== undefined)
        params.set("isGuest", String(options.isGuest));
    if (options?.userId)
        params.set("userId", options.userId);
    if (options?.locale)
        params.set("locale", options.locale);
    if (options?.cursor)
        params.set("cursor", options.cursor);
    if (options?.limit)
        params.set("limit", String(options.limit));
    const url = `${API_BASE}/admin/bylines${params.toString() ? `?${params}` : ""}`;
    const response = await apiFetch(url);
    return parseApiResponse(response, "Failed to fetch bylines");
}
export async function fetchByline(id) {
    const response = await apiFetch(`${API_BASE}/admin/bylines/${id}`);
    return parseApiResponse(response, "Failed to fetch byline");
}
export async function createByline(input) {
    const response = await apiFetch(`${API_BASE}/admin/bylines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, "Failed to create byline");
}
export async function updateByline(id, input) {
    const response = await apiFetch(`${API_BASE}/admin/bylines/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, "Failed to update byline");
}
export async function deleteByline(id) {
    const response = await apiFetch(`${API_BASE}/admin/bylines/${id}`, {
        method: "DELETE",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete byline`));
}
/**
 * Fetch every translation of a byline (siblings sharing the same
 * translation_group).
 */
export async function fetchBylineTranslations(id) {
    const response = await apiFetch(`${API_BASE}/admin/bylines/${id}/translations`);
    return parseApiResponse(response, "Failed to fetch byline translations");
}
/**
 * Create a new locale variant of a byline. The new row joins the source's
 * `translation_group`. Body defaults — slug, display name, avatar, website —
 * inherit from the source when omitted, so editors only have to fill in the
 * localized bio (and optionally a localized display name).
 */
export async function createBylineTranslation(id, input) {
    const response = await apiFetch(`${API_BASE}/admin/bylines/${id}/translations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, "Failed to create byline translation");
}
