/**
 * Auth Mode Detection
 *
 * Determines which authentication provider is active based on config.
 * Supports both passkey (default) and external auth providers via AuthDescriptor.
 */
/**
 * Determine the active auth mode from config.
 *
 * Accepts `EmDashConfig` (or subtype) — checks for `auth` field via duck typing.
 *
 * @param config EmDash configuration
 * @returns The active auth mode
 */
export function getAuthMode(config) {
    const auth = config?.auth;
    // Check for AuthDescriptor (transparent external auth like Cloudflare Access)
    if (auth && "entrypoint" in auth && auth.entrypoint) {
        return {
            type: "external",
            providerType: auth.type,
            entrypoint: auth.entrypoint,
            config: auth.config,
        };
    }
    // Default to passkey
    return { type: "passkey" };
}
/**
 * Check if an external auth provider is active
 */
export function isExternalAuthEnabled(config) {
    return getAuthMode(config).type === "external";
}
/**
 * Get external auth config if enabled
 */
export function getExternalAuthConfig(config) {
    const mode = getAuthMode(config);
    if (mode.type === "external") {
        return mode;
    }
    return null;
}
