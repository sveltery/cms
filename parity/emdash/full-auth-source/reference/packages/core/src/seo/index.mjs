/**
 * SEO Helpers
 *
 * Public API functions for generating SEO meta tags in Astro templates.
 *
 * @example
 * ```astro
 * ---
 * import { getEmDashEntry } from "emdash";
 * import { getSeoMeta } from "emdash/seo";
 *
 * const post = await getEmDashEntry("posts", Astro.params.slug);
 * const meta = await getSeoMeta(post, {
 *   siteTitle: "My Blog",
 *   siteUrl: Astro.url.origin,
 * });
 * ---
 * <html>
 *   <head>
 *     <title>{meta.title}</title>
 *     <meta name="description" content={meta.description} />
 *     <meta property="og:title" content={meta.ogTitle} />
 *     <meta property="og:description" content={meta.ogDescription} />
 *     {meta.ogImage && <meta property="og:image" content={meta.ogImage} />}
 *     <link rel="canonical" href={meta.canonical} />
 *     {meta.robots && <meta name="robots" content={meta.robots} />}
 *   </head>
 * </html>
 * ```
 */
import { buildSeoImageUrl, resolveSeoCanonicalUrl } from "./media-url.js";
export { getHreflangAlternates, getHreflangAlternatesWithDb } from "./hreflang.js";
const TRAILING_SLASH_RE = /\/$/;
/**
 * Generate resolved SEO meta tags from a content item.
 *
 * Uses the content item's SEO fields, falling back to content data
 * (title from `data.title`, description from `data.excerpt`).
 *
 * @param content - The content item (from getEmDashEntry, etc.)
 * @param options - Configuration for title construction, canonical URLs, etc.
 * @returns Resolved meta tags ready for template use
 */
export function getSeoMeta(content, options = {}) {
    const { siteTitle, siteUrl, path, defaultOgImage, defaultTitle, defaultDescription } = options;
    const separator = options.titleSeparator || " | ";
    // SEO can be in content.seo (ContentItem) or content.data.seo (ContentEntry)
    const seo = content.seo ??
        content.data.seo ?? {
        title: null,
        description: null,
        image: null,
        canonical: null,
        noIndex: false,
    };
    // Title: SEO panel title > caller default > content title
    const pageTitle = seo.title ||
        defaultTitle ||
        (typeof content.data.title === "string" ? content.data.title : null) ||
        "";
    const fullTitle = siteTitle && pageTitle ? `${pageTitle}${separator}${siteTitle}` : pageTitle;
    // Description: SEO panel description > caller default > excerpt
    const description = seo.description ||
        defaultDescription ||
        (typeof content.data.excerpt === "string" ? content.data.excerpt : null) ||
        null;
    // OG image: SEO image > default
    const ogImage = seo.image ? buildSeoImageUrl(seo.image, siteUrl) : (defaultOgImage ?? null);
    // Canonical: explicit > path-based > null. The explicit value goes
    // through the same resolver as the <EmDashHead> overlay, so a panel
    // canonical renders identically on both paths.
    let canonical = null;
    if (seo.canonical) {
        canonical = resolveSeoCanonicalUrl(seo.canonical, siteUrl);
    }
    else if (siteUrl && path) {
        const safePath = path.startsWith("/") ? path : `/${path}`;
        canonical = `${siteUrl.replace(TRAILING_SLASH_RE, "")}${safePath}`;
    }
    // Robots
    const robots = seo.noIndex ? "noindex, nofollow" : null;
    return {
        title: fullTitle,
        description,
        ogTitle: pageTitle || fullTitle,
        ogDescription: description,
        ogImage,
        canonical,
        robots,
    };
}
/**
 * Extract SEO data from a content item.
 *
 * Convenience accessor for the raw SEO fields without template resolution.
 *
 * @param content - The content item
 * @returns The content's SEO fields
 */
export function getContentSeo(content) {
    return content.seo ?? content.data.seo;
}
