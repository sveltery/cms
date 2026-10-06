/**
 * Redirects API client
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse, throwResponseError } from "./client.js";
/**
 * List redirects with optional filters
 */
export async function fetchRedirects(options) {
    const params = new URLSearchParams();
    if (options?.cursor)
        params.set("cursor", options.cursor);
    if (options?.limit != null)
        params.set("limit", String(options.limit));
    if (options?.search)
        params.set("search", options.search);
    if (options?.group)
        params.set("group", options.group);
    if (options?.enabled !== undefined)
        params.set("enabled", String(options.enabled));
    if (options?.auto !== undefined)
        params.set("auto", String(options.auto));
    const url = params.toString() ? `${API_BASE}/redirects?${params}` : `${API_BASE}/redirects`;
    const response = await apiFetch(url);
    return parseApiResponse(response, "Failed to fetch redirects");
}
/**
 * Create a redirect
 */
export async function createRedirect(input) {
    const response = await apiFetch(`${API_BASE}/redirects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, "Failed to create redirect");
}
/**
 * Update a redirect
 */
export async function updateRedirect(id, input) {
    const response = await apiFetch(`${API_BASE}/redirects/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, "Failed to update redirect");
}
/**
 * Delete a redirect
 */
export async function deleteRedirect(id) {
    const response = await apiFetch(`${API_BASE}/redirects/${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete redirect`));
}
/**
 * Fetch 404 summary (grouped by path, sorted by count)
 */
export async function fetch404Summary(limit) {
    const params = new URLSearchParams();
    if (limit != null)
        params.set("limit", String(limit));
    const url = params.toString()
        ? `${API_BASE}/redirects/404s/summary?${params}`
        : `${API_BASE}/redirects/404s/summary`;
    const response = await apiFetch(url);
    const data = await parseApiResponse(response, "Failed to fetch 404 summary");
    return data.items;
}
