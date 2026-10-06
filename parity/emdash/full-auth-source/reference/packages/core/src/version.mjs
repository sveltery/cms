/**
 * Build-time version constants, replaced by tsdown/Vite `define`.
 * Falls back to "dev" when running uncompiled (tests, dev).
 */
export const VERSION = typeof __EMDASH_VERSION__ !== "undefined" ? __EMDASH_VERSION__ : "dev";
export const COMMIT = typeof __EMDASH_COMMIT__ !== "undefined" ? __EMDASH_COMMIT__ : "dev";
