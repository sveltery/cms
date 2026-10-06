/**
 * @emdash-cms/plugin-types
 *
 * Shared TypeScript types for the EmDash plugin manifest contract.
 *
 * Two packages need to agree on this shape:
 *
 *   - **`emdash` (core)** reads `manifest.json` at install time and again at
 *     runtime when gating a sandboxed plugin's access to capabilities. Core
 *     is the contract reader.
 *   - **`@emdash-cms/plugin-cli`** writes `manifest.json` during bundling
 *     (extracted from the plugin author's source) and publishes the resulting
 *     records via atproto. plugin-cli is the contract writer.
 *
 * Anything that has to round-trip cleanly between writer and reader belongs
 * here: the capability vocabulary, the manifest shape, the hook/route entry
 * types, and the legacy-name rename map.
 *
 * Things that don't belong here:
 *
 *   - `ResolvedPlugin` and the rest of core's runtime plugin types — those
 *     are core-internal shapes for in-memory plugin instances and pull in
 *     a lot of Astro / blocks / schema dependencies.
 *   - The `@atcute/*` lexicon types for the registry's atproto records.
 *     Those live in `@emdash-cms/registry-lexicons` since they describe a
 *     different contract layer.
 */
/**
 * Mapping from deprecated capability names to their current replacements.
 *
 * Used to compare manifests across the rename without flagging spurious
 * "capability changed" prompts on upgrade, and to produce the warning
 * messages at bundle time.
 */
export const CAPABILITY_RENAMES = Object.freeze({
    "network:fetch": "network:request",
    "network:fetch:any": "network:request:unrestricted",
    "read:content": "content:read",
    "write:content": "content:write",
    "read:media": "media:read",
    "write:media": "media:write",
    "read:users": "users:read",
    "email:provide": "hooks.email-transport:register",
    "email:intercept": "hooks.email-events:register",
    "page:inject": "hooks.page-fragments:register",
});
/**
 * Type guard: is this capability one of the deprecated legacy names?
 *
 * Uses an own-property check so prototype keys like "toString" don't
 * accidentally pass.
 */
export function isDeprecatedCapability(cap) {
    return Object.hasOwn(CAPABILITY_RENAMES, cap);
}
/**
 * Normalize a capability string -- deprecated names map to current names,
 * current names pass through unchanged. Unknown strings are returned as-is
 * so downstream validators can produce a precise error.
 */
export function normalizeCapability(cap) {
    if (isDeprecatedCapability(cap)) {
        return CAPABILITY_RENAMES[cap];
    }
    return cap;
}
export function normalizeCapabilities(caps) {
    const seen = new Set();
    const out = [];
    for (const cap of caps) {
        const norm = normalizeCapability(cap);
        if (!seen.has(norm)) {
            seen.add(norm);
            out.push(norm);
        }
    }
    return out;
}
/**
 * Lower a normalized capability list + `allowedHosts` into the structured
 * `declaredAccess` contract. Total over the current capability vocabulary and
 * the inverse of {@link declaredAccessToCapabilities} for implication-closed
 * inputs (the shape `definePlugin` produces).
 *
 * Network semantics are faithful to the legacy capability/allowedHosts model:
 * an ABSENT `allowedHosts` key means unrestricted (`network:request:unrestricted`);
 * a PRESENT `allowedHosts` -- even an empty array -- means host-restricted
 * (`network:request`), where the empty list is deny-all at the runtime boundary.
 * An empty list never widens to unrestricted. (The record lexicon forbids the
 * empty array and publish rejects `network:request` with no hosts, so deny-all
 * only arises for non-registry/in-process plugins.)
 */
export function capabilitiesToDeclaredAccess(capabilities, allowedHosts) {
    const caps = new Set(capabilities.map((c) => normalizeCapability(c)));
    const out = {};
    if (caps.has("content:read") ||
        caps.has("content:revisions:read") ||
        caps.has("content:write") ||
        caps.has("content:publish")) {
        out.content = { read: {} };
        if (caps.has("content:write"))
            out.content.write = {};
    }
    if (caps.has("content:publish"))
        (out.content ??= {}).publish = {};
    if (caps.has("content:restore"))
        (out.content ??= {}).restore = {};
    if (caps.has("comments:read") || caps.has("comments:moderate")) {
        out.comments = { read: {} };
        if (caps.has("comments:moderate"))
            out.comments.moderate = {};
    }
    if (caps.has("content:revisions:read"))
        (out.content ??= {}).revisionsRead = {};
    if (caps.has("schema:read"))
        out.schema = { read: {} };
    if (caps.has("admin.editor-draft:read"))
        (out.admin ??= {}).editorDraftRead = {};
    if (caps.has("admin.editor-draft:patch"))
        (out.admin ??= {}).editorDraftPatch = {};
    if (caps.has("taxonomies:read") || caps.has("taxonomies:write")) {
        out.taxonomies = { read: {} };
        if (caps.has("taxonomies:write"))
            out.taxonomies.write = {};
    }
    if (caps.has("bylines:read"))
        out.bylines = { read: {} };
    if (caps.has("redirects:read") || caps.has("redirects:write")) {
        out.redirects = { read: {} };
        if (caps.has("redirects:write"))
            out.redirects.write = {};
    }
    if (caps.has("hooks.content-policy:register"))
        (out.content ??= {}).policy = {};
    if (caps.has("media:read") || caps.has("media:write")) {
        out.media = { read: {} };
        if (caps.has("media:write"))
            out.media.write = {};
    }
    if (caps.has("media:bytes:read"))
        (out.media ??= {}).bytesRead = {};
    if (caps.has("media:metadata:write"))
        (out.media ??= {}).metadataWrite = {};
    if (caps.has("network:request:unrestricted")) {
        // Unrestricted: omit allowedHosts entirely (its absence is what the
        // lexicon and the decoder read as "no host restriction").
        out.network = { request: {} };
    }
    else if (caps.has("network:request")) {
        // Host-restricted: carry the list verbatim, INCLUDING an empty list,
        // which is deny-all at the runtime boundary. Never collapse an empty
        // list to `{}` -- that would silently widen deny-all to unrestricted.
        out.network = { request: { allowedHosts: [...allowedHosts] } };
    }
    if (caps.has("email:send"))
        (out.email ??= {}).send = {};
    if (caps.has("hooks.email-events:register"))
        (out.email ??= {}).events = {};
    if (caps.has("hooks.email-transport:register"))
        (out.email ??= {}).transport = {};
    if (caps.has("hooks.page-fragments:register"))
        out.page = { fragments: {} };
    if (caps.has("users:read"))
        out.users = { read: {} };
    return out;
}
/**
 * Raise a `declaredAccess` block back to normalized capability strings +
 * `allowedHosts` -- the runtime's internal enforcement currency. Total: every
 * facet maps to exactly one capability. The result is closed under the same
 * implications `definePlugin` applies (write implies read; unrestricted implies
 * request), so it round-trips with {@link capabilitiesToDeclaredAccess}.
 */
export function declaredAccessToCapabilities(declaredAccess) {
    const caps = new Set();
    let allowedHosts = [];
    if (declaredAccess.content?.read)
        caps.add("content:read");
    if (declaredAccess.content?.revisionsRead) {
        caps.add("content:revisions:read");
        caps.add("content:read");
    }
    if (declaredAccess.content?.write) {
        caps.add("content:write");
        caps.add("content:read");
    }
    if (declaredAccess.content?.publish) {
        caps.add("content:publish");
        caps.add("content:read");
    }
    if (declaredAccess.content?.restore)
        caps.add("content:restore");
    if (declaredAccess.comments?.read)
        caps.add("comments:read");
    if (declaredAccess.comments?.moderate) {
        caps.add("comments:moderate");
        caps.add("comments:read");
    }
    if (declaredAccess.schema?.read)
        caps.add("schema:read");
    if (declaredAccess.admin?.editorDraftRead)
        caps.add("admin.editor-draft:read");
    if (declaredAccess.admin?.editorDraftPatch)
        caps.add("admin.editor-draft:patch");
    if (declaredAccess.content?.policy)
        caps.add("hooks.content-policy:register");
    if (declaredAccess.taxonomies?.read)
        caps.add("taxonomies:read");
    if (declaredAccess.taxonomies?.write) {
        caps.add("taxonomies:write");
        caps.add("taxonomies:read");
    }
    if (declaredAccess.bylines?.read)
        caps.add("bylines:read");
    if (declaredAccess.redirects?.read)
        caps.add("redirects:read");
    if (declaredAccess.redirects?.write) {
        caps.add("redirects:write");
        caps.add("redirects:read");
    }
    if (declaredAccess.media?.read)
        caps.add("media:read");
    if (declaredAccess.media?.bytesRead)
        caps.add("media:bytes:read");
    if (declaredAccess.media?.metadataWrite)
        caps.add("media:metadata:write");
    if (declaredAccess.media?.write) {
        caps.add("media:write");
        caps.add("media:read");
    }
    if (declaredAccess.network?.request) {
        const hosts = declaredAccess.network.request.allowedHosts;
        if (hosts === undefined) {
            // No allowedHosts key = unrestricted (lexicon semantics).
            caps.add("network:request:unrestricted");
            caps.add("network:request");
        }
        else {
            // allowedHosts present (even empty) = host-restricted. An empty list
            // is deny-all at the runtime boundary -- NEVER widen it to
            // unrestricted, or the most-restrictive spelling grants the most.
            caps.add("network:request");
            allowedHosts = [...hosts];
        }
    }
    if (declaredAccess.email?.send)
        caps.add("email:send");
    if (declaredAccess.email?.events)
        caps.add("hooks.email-events:register");
    if (declaredAccess.email?.transport)
        caps.add("hooks.email-transport:register");
    if (declaredAccess.page?.fragments)
        caps.add("hooks.page-fragments:register");
    if (declaredAccess.users?.read)
        caps.add("users:read");
    return { capabilities: [...caps], allowedHosts };
}
export { extractManifestRoute, extractRouteOptions, isJsonPostRouteContract, manifestRouteEntrySchema, normalizeManifestRoute, PLUGIN_ROUTE_BODY_MODES, PLUGIN_ROUTE_DEFAULT_BODY_BYTES, PLUGIN_ROUTE_MAX_BODY_BYTES, PLUGIN_ROUTE_MAX_DECLARED_HEADERS, PLUGIN_ROUTE_MAX_FILENAME_BYTES, PLUGIN_ROUTE_MAX_MULTIPART_PART_BYTES, PLUGIN_ROUTE_MAX_MULTIPART_PARTS, PLUGIN_ROUTE_METHODS, PLUGIN_ROUTE_RESPONSE_MODES, pluginRouteRequestSchema, routeNameSchema, routeOptionsSchema, } from "./routes.js";
// ── Slug / version helpers ───────────────────────────────────────────────────
const SLASH_RE = /\//g;
const LEADING_AT_RE = /^@/;
/**
 * Slug constraint per the registry lexicon: ASCII lowercase letter, then
 * lowercase letters / digits / hyphen / underscore, max 64 chars. The lexicon
 * description spells it out; the JSON itself only enforces minLength/maxLength
 * so we add the regex check here.
 */
export const PLUGIN_SLUG_RE = /^[a-z][a-z0-9_-]*$/;
export const PLUGIN_SLUG_MAX_LENGTH = 64;
/**
 * Version constraint per the registry lexicon: a subset of semver 2.0 with
 * the build-metadata suffix (`+...`) explicitly disallowed (atproto record
 * keys can't contain `+`), and the version composed only of characters
 * allowed in atproto record keys.
 *
 * The shape mirrors the official semver 2.0 BNF:
 *
 *   <major>.<minor>.<patch>[-<pre-release>]
 *
 * where each numeric component has no leading zeros (except the literal
 * `0`), and the optional pre-release is `.`-separated identifiers, each
 * being either a numeric (no leading zeros) or alphanumeric-with-hyphens
 * (must include a non-digit if it has hyphens).
 *
 * If you want to accept build metadata, this is the wrong type -- the
 * registry rejects it because the atproto rkey alphabet doesn't include
 * `+`. Build metadata is "ignored when comparing versions" per semver
 * anyway, so dropping it before publish is fine.
 */
export const PLUGIN_VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;
export const PLUGIN_VERSION_MAX_LENGTH = 64;
/**
 * Convert a plugin id (which may be a scoped npm name like
 * `@emdash-cms/sandboxed-test`) into a candidate slug suitable for use as an
 * atproto rkey. Strips a leading `@` and replaces `/` with `-`. The result
 * still needs `isPluginSlug()` validation -- callers should fail fast if
 * the manifest's id is malformed rather than relying on the PDS to reject.
 */
export function deriveSlugFromId(id) {
    return id.replace(LEADING_AT_RE, "").replace(SLASH_RE, "-");
}
export function isPluginSlug(value) {
    return value.length > 0 && value.length <= PLUGIN_SLUG_MAX_LENGTH && PLUGIN_SLUG_RE.test(value);
}
export function isPluginVersion(value) {
    return (value.length > 0 && value.length <= PLUGIN_VERSION_MAX_LENGTH && PLUGIN_VERSION_RE.test(value));
}
export { CURRENT_PLUGIN_CAPABILITIES, DEPRECATED_PLUGIN_CAPABILITIES, HOOK_NAMES, normalizeManifestHook, PLUGIN_CAPABILITIES, pluginManifestSchema, reconcileManifestAccess, } from "./manifest-schema.js";
export { canonicalizeDeclaredAccess, declaredAccessDigestInput, declaredAccessEqual, diffDeclaredAccess, isDeclaredAccessEscalation, } from "./declared-access.js";
