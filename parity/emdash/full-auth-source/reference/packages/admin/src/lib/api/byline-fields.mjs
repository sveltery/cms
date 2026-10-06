/**
 * Byline custom-field schema management API (Discussion #1174, Phase 4).
 *
 * Mirrors the server-side admin endpoints at
 * `/_emdash/api/admin/byline-fields/*`. Mutation responses use the
 * shared `ApiResult<T>` envelope; this client unwraps it via
 * `parseApiResponse` and surfaces typed errors through
 * `throwResponseError` (so the admin client sees the registry's
 * `FIELD_EXISTS` / `TRANSLATABLE_LOCKED` / `REORDER_MISMATCH` messages
 * verbatim).
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse, throwResponseError } from "./client.js";
// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------
const BASE = `${API_BASE}/admin/byline-fields`;
export async function listBylineFields() {
    const response = await apiFetch(BASE);
    return parseApiResponse(response, i18n._(msg `Failed to list byline fields`));
}
export async function getBylineFieldUsage(slug) {
    const response = await apiFetch(`${BASE}/${encodeURIComponent(slug)}/usage`);
    return parseApiResponse(response, i18n._(msg `Failed to read byline field usage`));
}
export async function createBylineField(input) {
    const response = await apiFetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, i18n._(msg `Failed to create byline field`));
}
export async function updateBylineField(slug, input) {
    const response = await apiFetch(`${BASE}/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, i18n._(msg `Failed to update byline field`));
}
export async function deleteBylineField(slug) {
    const response = await apiFetch(`${BASE}/${encodeURIComponent(slug)}`, {
        method: "DELETE",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete byline field`));
}
export async function reorderBylineFields(slugs) {
    const response = await apiFetch(`${BASE}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs }),
    });
    return parseApiResponse(response, i18n._(msg `Failed to reorder byline fields`));
}
