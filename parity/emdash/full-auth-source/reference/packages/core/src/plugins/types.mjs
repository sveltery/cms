/**
 * Plugin System Types v2
 *
 * New plugin API with:
 * - Single unified context shape for all hooks and routes
 * - Paginated storage queries (no async iterators)
 * - Unified KV API (replaces settings + options)
 * - Explicit ctx.http and ctx.log
 *
 */
// The plugin capability vocabulary, the legacy-rename map, and the manifest
// shape are authored once in @emdash-cms/plugin-types and shared between core
// (the manifest reader at install/runtime) and @emdash-cms/plugin-cli (the
// manifest writer at bundle/publish time).
//
// We import-and-re-export here so existing internal callers keep working
// (e.g. `import { PluginCapability } from "../plugins/types.js"`).
import { CAPABILITY_RENAMES, capabilitiesToDeclaredAccess, declaredAccessToCapabilities, isDeprecatedCapability, normalizeCapabilities, normalizeCapability, } from "@emdash-cms/plugin-types";
export { CAPABILITY_RENAMES, capabilitiesToDeclaredAccess, declaredAccessToCapabilities, isDeprecatedCapability, normalizeCapabilities, normalizeCapability, };
export const PLUGIN_CAPABILITY_IMPLICATIONS = [
    ["content:write", "content:read"],
    ["content:revisions:read", "content:read"],
    ["taxonomies:write", "taxonomies:read"],
    ["content:publish", "content:read"],
    ["media:write", "media:read"],
    ["comments:moderate", "comments:read"],
    ["redirects:write", "redirects:read"],
    ["network:request:unrestricted", "network:request"],
];
export function normalizePluginCapabilities(capabilities) {
    const normalized = new Set(normalizeCapabilities(capabilities));
    for (const [granted, implied] of PLUGIN_CAPABILITY_IMPLICATIONS) {
        if (normalized.has(granted))
            normalized.add(implied);
    }
    return [...normalized];
}
const WARNED_DEPRECATED_CAPABILITY_PLUGINS = Symbol.for("emdash:warned-deprecated-capability-plugins");
/**
 * Warn, once per plugin per process, that a plugin declares deprecated
 * capability names. Call with the plugin's raw, un-normalized capabilities.
 */
export function warnDeprecatedPluginCapabilities(pluginId, capabilities) {
    const deprecated = capabilities.filter(isDeprecatedCapability);
    if (deprecated.length === 0)
        return;
    const g = globalThis;
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- globalThis singleton pattern (see request-context.ts)
    const warned = (g[WARNED_DEPRECATED_CAPABILITY_PLUGINS] ??= new Set());
    if (warned.has(pluginId))
        return;
    warned.add(pluginId);
    const renames = deprecated.map((cap) => `${cap} → ${CAPABILITY_RENAMES[cap]}`).join(", ");
    console.warn(`[emdash] Plugin "${pluginId}" declares deprecated capability names (${renames}). ` +
        "They still work, but support will be removed in a future major release. " +
        "Update the plugin, or ask its author to publish a version that uses the current names.");
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _MANIFEST_COMPAT = true;
