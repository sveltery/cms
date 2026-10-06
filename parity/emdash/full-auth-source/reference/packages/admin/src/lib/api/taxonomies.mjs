/**
 * Taxonomies API (categories, tags, custom taxonomies).
 *
 * All endpoints are locale-aware. When no `locale` option is passed we omit
 * the query param and the server falls back to its usual resolution (no
 * filter, returning every locale — same as pre-i18n behaviour for clients
 * that haven't yet been updated).
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse, throwResponseError } from "./client.js";
export async function bulkTagPosts(termId, items, apply = false, refreshOnly = false) {
    const response = await apiFetch(`${API_BASE}/taxonomies/bulk-tag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termId, items, apply, ...(refreshOnly ? { refreshOnly: true } : {}) }),
    });
    return parseApiResponse(response, "Failed to add term to entries");
}
export function withLocale(path, locale) {
    return locale
        ? `${path}${path.includes("?") ? "&" : "?"}locale=${encodeURIComponent(locale)}`
        : path;
}
/**
 * Fetch all taxonomy definitions
 */
export async function fetchTaxonomyDefs(options = {}) {
    const response = await apiFetch(withLocale(`${API_BASE}/taxonomies`, options.locale));
    const data = await parseApiResponse(response, "Failed to fetch taxonomies");
    return data.taxonomies;
}
/**
 * Fetch taxonomy definition by name
 */
export async function fetchTaxonomyDef(name, options = {}) {
    const defs = await fetchTaxonomyDefs(options);
    return defs.find((t) => t.name === name) || null;
}
/**
 * Create a custom taxonomy definition
 */
export async function createTaxonomy(input) {
    const response = await apiFetch(`${API_BASE}/taxonomies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const data = await parseApiResponse(response, "Failed to create taxonomy");
    return data.taxonomy;
}
/**
 * Delete a taxonomy definition, its terms, and their content assignments.
 *
 * Takes no locale — the route removes the taxonomy in every language.
 */
export async function deleteTaxonomy(name) {
    const response = await apiFetch(`${API_BASE}/taxonomies/${name}`, { method: "DELETE" });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete taxonomy`));
}
/**
 * Fetch terms for a taxonomy
 */
export async function fetchTerms(taxonomyName, options = {}) {
    const params = new URLSearchParams();
    if (options.locale)
        params.set("locale", options.locale);
    if (options.includeCounts !== undefined)
        params.set("includeCounts", String(options.includeCounts));
    if (options.resolveFallback !== undefined)
        params.set("resolveFallback", String(options.resolveFallback));
    const query = params.size > 0 ? `?${params}` : "";
    const response = await apiFetch(`${API_BASE}/taxonomies/${taxonomyName}/terms${query}`);
    const data = await parseApiResponse(response, "Failed to fetch terms");
    return data.terms;
}
/**
 * Create a term
 */
export async function createTerm(taxonomyName, input) {
    const response = await apiFetch(`${API_BASE}/taxonomies/${taxonomyName}/terms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const data = await parseApiResponse(response, "Failed to create term");
    return data.term;
}
/**
 * Update a term
 */
export async function updateTerm(taxonomyName, slug, input, options = {}) {
    const response = await apiFetch(withLocale(`${API_BASE}/taxonomies/${taxonomyName}/terms/${slug}`, options.locale), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const data = await parseApiResponse(response, "Failed to update term");
    return data.term;
}
/**
 * Set the manual order of one sibling group.
 *
 * `ids` and `parentId` are translation groups: a term holds one position across
 * every locale, so there is no locale to pass. `ids` may name only the terms
 * this locale renders — the server permutes them within the positions they
 * already occupy and leaves untranslated members where they are.
 */
export async function reorderTerms(taxonomyName, input) {
    const response = await apiFetch(`${API_BASE}/taxonomies/${taxonomyName}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    await parseApiResponse(response, "Failed to reorder terms");
}
/**
 * Delete a term
 */
export async function deleteTerm(taxonomyName, slug, options = {}) {
    const response = await apiFetch(withLocale(`${API_BASE}/taxonomies/${taxonomyName}/terms/${slug}`, options.locale), { method: "DELETE" });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete term`));
}
/** List every translation (locale variant) of a term. */
export async function fetchTermTranslations(taxonomyName, slug, options = {}) {
    const response = await apiFetch(withLocale(`${API_BASE}/taxonomies/${taxonomyName}/terms/${slug}/translations`, options.locale));
    return parseApiResponse(response, "Failed to fetch term translations");
}
/**
 * Create a new locale translation of a term. The new term inherits slug,
 * label, parent, and description from the source unless overridden in `input`.
 */
export async function createTermTranslation(taxonomyName, slug, input, options = {}) {
    const response = await apiFetch(withLocale(`${API_BASE}/taxonomies/${taxonomyName}/terms/${slug}/translations`, options.locale), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const data = await parseApiResponse(response, "Failed to create term translation");
    return data.term;
}
