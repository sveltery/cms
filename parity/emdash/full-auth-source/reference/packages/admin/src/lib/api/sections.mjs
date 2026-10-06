/**
 * Sections API (reusable content blocks)
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse, throwResponseError } from "./client.js";
/**
 * Fetch all sections
 */
export async function fetchSections(options) {
    const params = new URLSearchParams();
    if (options?.source)
        params.set("source", options.source);
    if (options?.search)
        params.set("search", options.search);
    if (options?.limit)
        params.set("limit", String(options.limit));
    if (options?.cursor)
        params.set("cursor", options.cursor);
    const url = params.toString() ? `${API_BASE}/sections?${params}` : `${API_BASE}/sections`;
    const response = await apiFetch(url);
    return parseApiResponse(response, i18n._(msg `Failed to fetch sections`));
}
/**
 * Fetch a single section by slug
 */
export async function fetchSection(slug) {
    const response = await apiFetch(`${API_BASE}/sections/${slug}`);
    return parseApiResponse(response, i18n._(msg `Failed to fetch section`));
}
/**
 * Create a section
 */
export async function createSection(input) {
    const response = await apiFetch(`${API_BASE}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, i18n._(msg `Failed to create section`));
}
/**
 * Update a section
 */
export async function updateSection(slug, input) {
    const response = await apiFetch(`${API_BASE}/sections/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, i18n._(msg `Failed to update section`));
}
/**
 * Delete a section
 */
export async function deleteSection(slug) {
    const response = await apiFetch(`${API_BASE}/sections/${slug}`, {
        method: "DELETE",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete section`));
}
