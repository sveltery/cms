/**
 * Runtime utilities for EmDash
 *
 * This file contains functions that are used at runtime (in middleware, routes, etc.)
 * and must work in all environments including Cloudflare Workers.
 *
 * DO NOT import Node.js-only modules here (fs, path, module, etc.)
 */
const STORED_CONFIG_KEY = Symbol.for("emdash:stored-config");
const configHolder = globalThis;
/**
 * Get stored config from global
 * This is set by the virtual module at build time
 */
export function getStoredConfig() {
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- globalThis singleton pattern (see request-context.ts)
    return configHolder[STORED_CONFIG_KEY] ?? null;
}
/**
 * Set stored config in global
 * Called by the integration at config time
 */
export function setStoredConfig(config) {
    configHolder[STORED_CONFIG_KEY] = config;
}
