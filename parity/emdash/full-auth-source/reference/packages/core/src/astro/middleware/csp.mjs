/** Entrypoint constant used by the `s3()` adapter (see `astro/storage/adapters.ts`). */
const S3_ADAPTER_ENTRYPOINT = "emdash/storage/s3";
/**
 * Storage entrypoints are free to shape their config however they like, so
 * `endpoint` isn't a known field on `StorageDescriptor["config"]` -- only
 * S3-compatible adapters (R2, S3, Minio, ...) set it. Anything else (e.g.
 * local filesystem storage) simply has no `endpoint` to allow.
 *
 * The `s3()` adapter resolves any field omitted from its config -- including
 * `endpoint` -- from the matching `S3_*` env var at runtime (see
 * `storage/s3.ts`'s `resolveS3Config`). A site configured as `s3({ ... })`
 * with only `S3_ENDPOINT` set has no `endpoint` in the descriptor's config,
 * so fall back to that env var for S3-adapter storage. Custom adapters can
 * expose their runtime upload origin through `getClientUploadOrigin()`.
 */
export function getConfiguredStorageEndpoint(storage, runtimeStorage) {
    const config = storage?.config;
    if (typeof config === "object" && config !== null && "endpoint" in config) {
        const endpoint = config.endpoint;
        if (typeof endpoint === "string")
            return endpoint;
    }
    if (storage?.entrypoint === S3_ADAPTER_ENTRYPOINT) {
        const envEndpoint = typeof process !== "undefined" && process.env ? process.env.S3_ENDPOINT : undefined;
        if (envEndpoint)
            return envEndpoint;
    }
    return runtimeStorage?.getClientUploadOrigin?.();
}
function getRegistryAggregatorOrigin(registry) {
    const aggregatorUrl = typeof registry === "string" ? registry : registry?.aggregatorUrl;
    if (!aggregatorUrl)
        return undefined;
    try {
        const url = new URL(aggregatorUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:")
            return undefined;
        return url.origin;
    }
    catch {
        return undefined;
    }
}
function getHttpOrigin(rawUrl) {
    if (!rawUrl)
        return undefined;
    try {
        const url = new URL(rawUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:")
            return undefined;
        return url.origin;
    }
    catch {
        return undefined;
    }
}
export function buildEmDashCsp(registry, storageEndpoint) {
    const connectSrc = ["connect-src 'self'"];
    const origins = new Set();
    const registryAggregatorOrigin = getRegistryAggregatorOrigin(registry);
    if (registryAggregatorOrigin)
        origins.add(registryAggregatorOrigin);
    const storageOrigin = getHttpOrigin(storageEndpoint);
    if (storageOrigin)
        origins.add(storageOrigin);
    connectSrc.push(...origins);
    return [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        connectSrc.join(" "),
        "form-action 'self'",
        "frame-src 'self' https:",
        "frame-ancestors 'none'",
        "img-src 'self' https: data: blob:",
        "object-src 'none'",
        "base-uri 'self'",
    ].join("; ");
}
