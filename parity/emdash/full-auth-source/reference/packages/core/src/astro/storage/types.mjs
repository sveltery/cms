/**
 * Storage Adapter Types
 *
 * Adapters use a serializable descriptor pattern:
 * - Config-time function returns { entrypoint, config }
 * - Runtime loads entrypoint and calls createStorage(config)
 *
 * Each adapter is responsible for accessing its own bindings.
 * For Cloudflare (R2), use `@emdash-cms/cloudflare` package.
 */
export {};
