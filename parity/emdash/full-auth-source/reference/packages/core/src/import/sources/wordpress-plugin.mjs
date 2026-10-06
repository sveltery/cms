/**
 * WordPress Plugin (EmDash Exporter) import source
 *
 * Connects to self-hosted WordPress sites running the EmDash Exporter plugin.
 * Provides full access to all content including drafts, custom post types, and ACF fields.
 */
import { gutenbergToPortableText } from "@emdash-cms/gutenberg-to-portable-text";
import { encodeBase64 } from "../../utils/base64.js";
import { ssrfSafeFetch, validateExternalUrl } from "../ssrf.js";
import { BASE_REQUIRED_FIELDS, FEATURED_IMAGE_FIELD, mapPostTypeToCollection, mapWpStatus, normalizeUrl, checkSchemaCompatibility, isPluginBookkeepingMeta, relativizeContentLinks, sanitizeFieldSlug, } from "../utils.js";
// =============================================================================
// Constants
// =============================================================================
/** Pattern to remove spaces from application passwords */
const SPACE_PATTERN = /\s/g;
/**
 * Build the REST API URL for a plugin endpoint.
 *
 * `restRoute: false` uses the pretty form (`/wp-json/emdash/v1/...`),
 * `restRoute: true` uses the `?rest_route=` form that works on sites with
 * plain permalinks (where `/wp-json/` doesn't exist).
 */
function pluginApiUrl(siteUrl, path, params = {}, restRoute = false) {
    if (restRoute) {
        const url = new URL(siteUrl + "/");
        url.searchParams.set("rest_route", `/emdash/v1/${path}`);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }
        return url.toString();
    }
    const url = new URL(`${siteUrl}/wp-json/emdash/v1/${path}`);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    return url.toString();
}
/**
 * Fetch a plugin API endpoint, falling back to the `?rest_route=` form when
 * the pretty `/wp-json/` route 404s or is unreachable. Sites with "Plain"
 * permalinks have no `/wp-json/` rewrite, so without this fallback they
 * always fail with a misleading 404.
 */
async function fetchPluginApi(siteUrl, path, params, headers, timeoutMs) {
    let pretty = null;
    try {
        pretty = await ssrfSafeFetch(pluginApiUrl(siteUrl, path, params), {
            headers,
            signal: AbortSignal.timeout(timeoutMs),
        });
    }
    catch {
        // Network-level failure -- try the rest_route form before giving up.
    }
    // Any response other than 404 (including 401/403/500) is authoritative:
    // the route exists, so don't mask the real error with a fallback attempt.
    if (pretty && pretty.status !== 404) {
        return pretty;
    }
    return ssrfSafeFetch(pluginApiUrl(siteUrl, path, params, true), {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
    });
}
// =============================================================================
// Import Source
// =============================================================================
export const wordpressPluginSource = {
    id: "wordpress-plugin",
    name: "WordPress (EmDash Exporter)",
    description: "Import from WordPress sites with the EmDash Exporter plugin installed",
    icon: "plug",
    requiresFile: false,
    canProbe: true,
    async probe(url) {
        try {
            const siteUrl = normalizeUrl(url);
            // SSRF protection: validate URL before any outbound requests
            validateExternalUrl(siteUrl);
            const response = await fetchPluginApi(siteUrl, "probe", {}, { Accept: "application/json" }, 10000);
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            // Verify it's actually our plugin
            if (!data.emdash_exporter) {
                return null;
            }
            return {
                sourceId: "wordpress-plugin",
                confidence: "definite",
                detected: {
                    platform: "wordpress",
                    version: data.wordpress_version,
                    siteTitle: data.site.title,
                    siteUrl: data.site.url,
                },
                capabilities: {
                    publicContent: true,
                    privateContent: true, // Full access with auth
                    customPostTypes: true,
                    allMeta: true,
                    mediaStream: true,
                },
                auth: data.capabilities.application_passwords
                    ? {
                        type: "password",
                        instructions: data.auth_instructions.instructions,
                    }
                    : undefined,
                preview: {
                    posts: data.post_types.find((p) => p.name === "post")?.count,
                    pages: data.post_types.find((p) => p.name === "page")?.count,
                    media: data.media_count,
                },
                suggestedAction: {
                    type: "proceed",
                },
                i18n: pluginI18nToDetection(data.i18n),
            };
        }
        catch {
            return null;
        }
    },
    async analyze(input, context) {
        const { siteUrl, headers } = getRequestConfig(input);
        const response = await fetchPluginApi(siteUrl, "analyze", {}, headers, 30000);
        if (!response.ok) {
            const body = await response.json().catch(() => undefined);
            const message = typeof body === "object" &&
                body !== null &&
                "message" in body &&
                typeof body.message === "string"
                ? body.message
                : "";
            throw new Error(message || `Failed to analyze site: ${response.statusText}`);
        }
        const data = await response.json();
        // Get existing collections for schema check
        const existingCollections = context.getExistingCollections
            ? await context.getExistingCollections()
            : new Map();
        // Build post type analysis
        const postTypes = data.post_types
            .filter((pt) => pt.total > 0)
            .map((pt) => {
            const suggestedCollection = mapPostTypeToCollection(pt.name);
            const existingCollection = existingCollections.get(suggestedCollection);
            // Include featured_image if post type supports thumbnails
            const supportsThumbnail = pt.supports && "thumbnail" in pt.supports;
            const requiredFields = supportsThumbnail
                ? [...BASE_REQUIRED_FIELDS, FEATURED_IMAGE_FIELD]
                : [...BASE_REQUIRED_FIELDS];
            // Surface the post type's custom fields (ACF and plain meta) so
            // the prepare step creates them — without this, execute() has no
            // matching schema fields and silently drops the values.
            const knownSlugs = new Set(requiredFields.map((f) => f.slug));
            for (const customField of pt.custom_fields ?? []) {
                if (isPluginBookkeepingMeta(customField.key))
                    continue;
                const slug = sanitizeFieldSlug(customField.key);
                if (knownSlugs.has(slug))
                    continue;
                knownSlugs.add(slug);
                requiredFields.push({
                    slug,
                    label: fieldLabelFromKey(customField.key),
                    type: mapInferredFieldType(customField.inferred_type),
                    required: false,
                });
            }
            return {
                name: pt.name,
                count: pt.total,
                suggestedCollection,
                requiredFields,
                schemaStatus: checkSchemaCompatibility(requiredFields, existingCollection),
            };
        });
        // Fetch the full media list, paginated. Stopping after the first page
        // silently capped imports at 500 attachments (wp-emdash #1).
        const attachments = [];
        if (data.attachments.count > 0) {
            try {
                let page = 1;
                let totalPages = 1;
                while (page <= totalPages) {
                    const mediaResponse = await fetchPluginApi(siteUrl, "media", { per_page: "500", page: String(page) }, headers, 30000);
                    if (!mediaResponse.ok)
                        break;
                    const mediaData = await mediaResponse.json();
                    totalPages = mediaData.pages;
                    for (const item of mediaData.items) {
                        attachments.push({
                            id: item.id,
                            url: item.url,
                            filename: item.filename,
                            mimeType: item.mime_type,
                            title: item.title,
                            alt: item.alt,
                            caption: item.caption,
                            width: item.width,
                            height: item.height,
                        });
                    }
                    page++;
                }
            }
            catch (e) {
                console.warn("Failed to fetch media list:", e);
            }
        }
        // Count categories and tags
        const categoryTaxonomy = data.taxonomies.find((t) => t.name === "category");
        const tagTaxonomy = data.taxonomies.find((t) => t.name === "post_tag");
        return {
            sourceId: "wordpress-plugin",
            site: {
                title: data.site.title,
                url: data.site.url,
            },
            postTypes,
            attachments: {
                count: data.attachments.count,
                items: attachments,
            },
            categories: categoryTaxonomy?.term_count ?? 0,
            tags: tagTaxonomy?.term_count ?? 0,
            authors: data.authors.map((a) => ({
                id: a.id,
                login: a.login,
                email: a.email,
                displayName: a.display_name,
                postCount: a.post_count,
            })),
            i18n: pluginI18nToDetection(data.i18n),
        };
    },
    async *fetchContent(input, options) {
        const { siteUrl, headers } = getRequestConfig(input);
        for (const postType of options.postTypes) {
            let page = 1;
            let totalPages = 1;
            let yielded = 0;
            while (page <= totalPages) {
                const status = options.includeDrafts ? "any" : "publish";
                const response = await fetchPluginApi(siteUrl, "content", { post_type: postType, status, per_page: "100", page: String(page) }, headers, 60000);
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${postType}: ${response.statusText}`);
                }
                const data = await response.json();
                totalPages = data.pages;
                for (const post of data.items) {
                    yield pluginPostToNormalizedItem(post, siteUrl);
                    yielded++;
                    if (options.limit && yielded >= options.limit) {
                        return;
                    }
                }
                page++;
            }
        }
    },
    async fetchMedia(url, _input) {
        // SSRF protection: validate media URL before fetching
        validateExternalUrl(url);
        // Media URLs are publicly accessible on WP (ssrfSafeFetch validates redirects)
        const response = await ssrfSafeFetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch media: ${response.statusText}`);
        }
        return response.blob();
    },
};
/**
 * Fetch a single page of content for one post type. This is the unit of
 * work for the chunked import: one Worker invocation imports one page,
 * keeping each request far below Cloudflare's CPU and subrequest limits
 * (see issue #475).
 */
export async function fetchPluginContentPage(options) {
    const { siteUrl, headers } = getRequestConfig({
        type: "url",
        url: options.siteUrl,
        token: options.token,
    });
    const response = await fetchPluginApi(siteUrl, "content", {
        post_type: options.postType,
        status: options.includeDrafts ? "any" : "publish",
        per_page: String(options.perPage),
        page: String(options.page),
    }, headers, 60000);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${options.postType}: ${response.statusText}`);
    }
    const data = await response.json();
    return {
        items: data.items.map((post) => pluginPostToNormalizedItem(post, siteUrl)),
        totalPages: data.pages,
    };
}
// =============================================================================
// Helper Functions
// =============================================================================
/** Plugin `inferred_type` values that are valid EmDash field types as-is */
const VALID_INFERRED_TYPES = new Set([
    "string",
    "text",
    "number",
    "integer",
    "boolean",
    "datetime",
    "json",
    "reference",
]);
/**
 * Map the plugin's inferred custom-field type to an EmDash field type.
 * Unknown values fall back to string (always safe for TEXT storage).
 */
function mapInferredFieldType(inferredType) {
    return VALID_INFERRED_TYPES.has(inferredType) ? inferredType : "string";
}
const FIELD_KEY_SEPARATORS = /[_-]+/;
/** Derive a human label from a meta key: "event_start-date" -> "Event Start Date" */
function fieldLabelFromKey(key) {
    return key
        .split(FIELD_KEY_SEPARATORS)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}
/**
 * Convert plugin i18n info to the shared I18nDetection type.
 * Returns undefined when no multilingual plugin is detected.
 */
function pluginI18nToDetection(i18n) {
    if (!i18n)
        return undefined;
    return {
        plugin: i18n.plugin,
        defaultLocale: i18n.default_locale,
        locales: i18n.locales,
    };
}
/**
 * Get request configuration from input
 */
function getRequestConfig(input) {
    if (input.type === "url") {
        const siteUrl = normalizeUrl(input.url);
        // SSRF protection: validate URL before any outbound requests
        validateExternalUrl(siteUrl);
        const headers = {
            Accept: "application/json",
        };
        if (input.token) {
            // Token format: "username:password" base64 encoded
            headers["Authorization"] = `Basic ${input.token}`;
        }
        return { siteUrl, headers };
    }
    if (input.type === "oauth") {
        const oauthSiteUrl = normalizeUrl(input.url);
        // SSRF protection: validate URL before any outbound requests
        validateExternalUrl(oauthSiteUrl);
        return {
            siteUrl: oauthSiteUrl,
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${input.accessToken}`,
            },
        };
    }
    throw new Error("WordPress plugin source requires URL or OAuth input");
}
/**
 * Convert plugin post to normalized item
 */
function pluginPostToNormalizedItem(post, siteUrl) {
    const content = post.content ? gutenbergToPortableText(post.content) : [];
    relativizeContentLinks(content, siteUrl);
    // Extract categories and tags from taxonomies
    const categories = post.taxonomies?.category?.map((c) => c.slug) ??
        post.taxonomies?.categories?.map((c) => c.slug) ??
        [];
    const tags = post.taxonomies?.post_tag?.map((t) => t.slug) ??
        post.taxonomies?.tags?.map((t) => t.slug) ??
        [];
    // Everything else is a custom taxonomy assignment (genre, product_cat, ...)
    const customTaxonomies = {};
    for (const [name, terms] of Object.entries(post.taxonomies ?? {})) {
        if (["category", "categories", "post_tag", "tags"].includes(name))
            continue;
        if (Array.isArray(terms) && terms.length > 0) {
            customTaxonomies[name] = terms.map((t) => t.slug);
        }
    }
    // Build meta from various sources
    const meta = { ...post.meta };
    // Include ACF fields in meta
    if (post.acf) {
        meta._acf = post.acf;
    }
    // Include SEO data in meta
    if (post.yoast) {
        meta._yoast = post.yoast;
    }
    if (post.rankmath) {
        meta._rankmath = post.rankmath;
    }
    return {
        sourceId: post.id,
        postType: post.post_type,
        status: mapWpStatus(post.status),
        slug: post.slug,
        title: post.title,
        content,
        excerpt: post.excerpt || undefined,
        date: new Date(post.date_gmt || post.date),
        modified: post.modified_gmt ? new Date(post.modified_gmt) : new Date(post.modified),
        author: post.author?.login,
        categories,
        tags,
        customTaxonomies: Object.keys(customTaxonomies).length > 0 ? customTaxonomies : undefined,
        meta,
        featuredImage: post.featured_image?.url,
        locale: post.locale,
        translationGroup: post.translation_group,
    };
}
// =============================================================================
// Utility Functions for External Use
// =============================================================================
/**
 * Create a Basic Auth token from username and password
 */
export function createBasicAuthToken(username, password) {
    // Remove spaces from application password (WP formats them with spaces)
    const cleanPassword = password.replace(SPACE_PATTERN, "");
    return encodeBase64(`${username}:${cleanPassword}`);
}
/**
 * Fetch media list from plugin API
 */
export async function fetchPluginMedia(siteUrl, authToken, page = 1, perPage = 100) {
    const normalizedSiteUrl = normalizeUrl(siteUrl);
    // SSRF protection: validate URL before any outbound requests
    validateExternalUrl(normalizedSiteUrl);
    const response = await fetchPluginApi(normalizedSiteUrl, "media", { per_page: String(perPage), page: String(page) }, { Accept: "application/json", Authorization: `Basic ${authToken}` }, 30000);
    if (!response.ok) {
        throw new Error(`Failed to fetch media: ${response.statusText}`);
    }
    return response.json();
}
/**
 * Fetch taxonomies from plugin API
 */
export async function fetchPluginTaxonomies(siteUrl, authToken) {
    const normalizedSiteUrl = normalizeUrl(siteUrl);
    // SSRF protection: validate URL before any outbound requests
    validateExternalUrl(normalizedSiteUrl);
    const response = await fetchPluginApi(normalizedSiteUrl, "taxonomies", {}, { Accept: "application/json", Authorization: `Basic ${authToken}` }, 30000);
    if (!response.ok) {
        throw new Error(`Failed to fetch taxonomies: ${response.statusText}`);
    }
    return response.json();
}
/**
 * Fetch navigation menus from plugin API (added in emdash-exporter 1.1.0).
 * Returns an empty array when the endpoint doesn't exist (older plugin).
 */
export async function fetchPluginMenus(siteUrl, authToken) {
    const normalizedSiteUrl = normalizeUrl(siteUrl);
    // SSRF protection: validate URL before any outbound requests
    validateExternalUrl(normalizedSiteUrl);
    const response = await fetchPluginApi(normalizedSiteUrl, "menus", {}, { Accept: "application/json", Authorization: `Basic ${authToken}` }, 30000);
    if (response.status === 404) {
        return [];
    }
    if (!response.ok) {
        throw new Error(`Failed to fetch menus: ${response.statusText}`);
    }
    return response.json();
}
/**
 * Fetch site options from plugin API (title, tagline, logo, favicon, ...)
 */
export async function fetchPluginOptions(siteUrl, authToken) {
    const normalizedSiteUrl = normalizeUrl(siteUrl);
    // SSRF protection: validate URL before any outbound requests
    validateExternalUrl(normalizedSiteUrl);
    const response = await fetchPluginApi(normalizedSiteUrl, "options", {}, { Accept: "application/json", Authorization: `Basic ${authToken}` }, 30000);
    if (!response.ok) {
        throw new Error(`Failed to fetch options: ${response.statusText}`);
    }
    return response.json();
}
/**
 * Fetch a single page of comments from the plugin API (added in
 * emdash-exporter 1.2.0). The exporter orders by comment ID ascending, so
 * parents always appear before their children across pages. Returns
 * `totalPages: 0` when the endpoint doesn't exist (older plugin).
 */
export async function fetchPluginCommentsPage(siteUrl, authToken, page) {
    const normalizedSiteUrl = normalizeUrl(siteUrl);
    // SSRF protection: validate URL before any outbound requests
    validateExternalUrl(normalizedSiteUrl);
    const response = await fetchPluginApi(normalizedSiteUrl, "comments", { per_page: "500", page: String(page) }, { Accept: "application/json", Authorization: `Basic ${authToken}` }, 30000);
    if (response.status === 404) {
        return { items: [], totalPages: 0 };
    }
    if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.statusText}`);
    }
    const data = await response.json();
    return { items: data.items, totalPages: data.pages };
}
/**
 * Fetch all comments from plugin API, paginating through every page.
 * Returns an empty array when the endpoint doesn't exist (older plugin).
 */
export async function fetchPluginComments(siteUrl, authToken) {
    const comments = [];
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
        const result = await fetchPluginCommentsPage(siteUrl, authToken, page);
        totalPages = result.totalPages;
        comments.push(...result.items);
        page++;
    }
    return comments;
}
