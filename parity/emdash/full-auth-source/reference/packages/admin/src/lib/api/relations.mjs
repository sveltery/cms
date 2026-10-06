/**
 * Relations API (reference field definitions and links).
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse } from "./client.js";
/**
 * Fetch relation definitions, optionally only those `collection` takes part in.
 */
export async function fetchRelations(opts = {}) {
    const qs = opts.collection ? `?collection=${encodeURIComponent(opts.collection)}` : "";
    const response = await apiFetch(`${API_BASE}/relations${qs}`);
    const data = await parseApiResponse(response, "Failed to fetch relations");
    return data.relations;
}
/**
 * Fetch one relation by id.
 */
export async function fetchRelation(id) {
    const response = await apiFetch(`${API_BASE}/relations/${encodeURIComponent(id)}`);
    const data = await parseApiResponse(response, "Failed to fetch relation");
    return data.relation;
}
export async function createRelation(input) {
    const response = await apiFetch(`${API_BASE}/relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const data = await parseApiResponse(response, "Failed to create relation");
    return data.relation;
}
export async function updateRelation(id, input) {
    const response = await apiFetch(`${API_BASE}/relations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const data = await parseApiResponse(response, "Failed to update relation");
    return data.relation;
}
/**
 * Delete a relation, its links, and every reference field bound to it.
 */
export async function deleteRelation(id) {
    const response = await apiFetch(`${API_BASE}/relations/${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
    const data = await parseApiResponse(response, i18n._(msg `Failed to delete relation`));
    return data.deletedFields;
}
function buildPageQuery(opts = {}) {
    const params = new URLSearchParams();
    if (opts.cursor)
        params.set("cursor", opts.cursor);
    if (opts.limit)
        params.set("limit", String(opts.limit));
    const qs = params.toString();
    return qs ? `?${qs}` : "";
}
/**
 * Fetch the children of an entry for a given relation (parent side).
 */
export async function fetchReferenceChildren(collection, id, relation, opts = {}) {
    const qs = buildPageQuery(opts);
    const response = await apiFetch(`${API_BASE}/content/${collection}/${id}/references/${relation}/children${qs}`);
    return parseApiResponse(response, "Failed to fetch reference children");
}
/**
 * Fetch the parents of an entry for a given relation (child side).
 */
export async function fetchReferenceParents(collection, id, relation, opts = {}) {
    const qs = buildPageQuery(opts);
    const response = await apiFetch(`${API_BASE}/content/${collection}/${id}/references/${relation}/parents${qs}`);
    return parseApiResponse(response, "Failed to fetch reference parents");
}
