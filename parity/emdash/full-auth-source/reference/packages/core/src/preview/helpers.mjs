/**
 * Preview helpers for Astro pages
 */
/**
 * Check if a request is a preview request
 *
 * @example
 * ```ts
 * const isPreview = isPreviewRequest(Astro.url);
 * ```
 */
export function isPreviewRequest(url) {
    return url.searchParams.has("_preview");
}
/**
 * Get the preview token from a URL
 *
 * @example
 * ```ts
 * const token = getPreviewToken(Astro.url);
 * ```
 */
export function getPreviewToken(url) {
    return url.searchParams.get("_preview");
}
