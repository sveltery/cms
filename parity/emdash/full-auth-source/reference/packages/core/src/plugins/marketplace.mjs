/**
 * MarketplaceClient — HTTP client for the EmDash Plugin Marketplace
 *
 * Used by the install/update/proxy endpoints in EmDash core to communicate
 * with the marketplace Worker. The marketplace is a distribution channel,
 * not a runtime dependency — bundles are copied to site-local R2 at install time.
 */
import { createGzipDecoder, unpackTar } from "modern-tar";
import { pluginManifestSchema, reconcileManifestAccess } from "./manifest-schema.js";
// ── Module-level regex patterns ───────────────────────────────────
const TRAILING_SLASHES = /\/+$/;
const LEADING_DOT_SLASH = /^\.\//;
// ── Errors ─────────────────────────────────────────────────────────
export class MarketplaceError extends Error {
    status;
    code;
    constructor(message, status, code) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = "MarketplaceError";
    }
}
export class MarketplaceUnavailableError extends MarketplaceError {
    constructor(cause) {
        super("Plugin marketplace is unavailable", undefined, "MARKETPLACE_UNAVAILABLE");
        if (cause)
            this.cause = cause;
    }
}
const MAX_REDIRECTS = 5;
/**
 * Fetches a marketplace URL, following redirects only while they stay on
 * that URL's origin. Throws a `MarketplaceError` coded
 * `${codePrefix}_REDIRECT_UNTRUSTED` or `${codePrefix}_TOO_MANY_REDIRECTS`.
 */
export async function fetchWithinOrigin(url, label, codePrefix) {
    const origin = new URL(url).origin;
    let currentUrl = url;
    let response = await fetch(currentUrl, { redirect: "manual" });
    for (let i = 0; i < MAX_REDIRECTS; i++) {
        if (response.status < 300 || response.status >= 400)
            break;
        const location = response.headers.get("location");
        if (!location)
            break;
        const target = new URL(location, currentUrl);
        if (target.origin !== origin) {
            throw new MarketplaceError(`${label} redirected to untrusted host: ${target.origin}`, response.status, `${codePrefix}_REDIRECT_UNTRUSTED`);
        }
        currentUrl = target.href;
        response = await fetch(currentUrl, { redirect: "manual" });
    }
    if (response.status >= 300 && response.status < 400) {
        throw new MarketplaceError(`${label} exceeded maximum redirects (${MAX_REDIRECTS})`, response.status, `${codePrefix}_TOO_MANY_REDIRECTS`);
    }
    return response;
}
// ── Implementation ─────────────────────────────────────────────────
class MarketplaceClientImpl {
    baseUrl;
    siteOrigin;
    constructor(baseUrl, siteOrigin) {
        // Strip trailing slash
        this.baseUrl = baseUrl.replace(TRAILING_SLASHES, "");
        this.siteOrigin = siteOrigin;
    }
    async search(query, opts) {
        const params = new URLSearchParams();
        if (query)
            params.set("q", query);
        if (opts?.category)
            params.set("category", opts.category);
        if (opts?.capability)
            params.set("capability", opts.capability);
        if (opts?.sort)
            params.set("sort", opts.sort);
        if (opts?.cursor)
            params.set("cursor", opts.cursor);
        if (opts?.limit)
            params.set("limit", String(opts.limit));
        const qs = params.toString();
        const url = `${this.baseUrl}/api/v1/plugins${qs ? `?${qs}` : ""}`;
        const data = await this.fetchJson(url);
        return data;
    }
    async getPlugin(id) {
        const url = `${this.baseUrl}/api/v1/plugins/${encodeURIComponent(id)}`;
        return this.fetchJson(url);
    }
    async getVersions(id) {
        const url = `${this.baseUrl}/api/v1/plugins/${encodeURIComponent(id)}/versions`;
        const data = await this.fetchJson(url);
        return data.items;
    }
    async downloadBundle(id, version) {
        const bundleUrl = `${this.baseUrl}/api/v1/plugins/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/bundle`;
        let response;
        try {
            response = await fetchWithinOrigin(bundleUrl, "Bundle download", "BUNDLE");
        }
        catch (err) {
            if (err instanceof MarketplaceError)
                throw err;
            throw new MarketplaceUnavailableError(err);
        }
        if (!response.ok) {
            throw new MarketplaceError(`Failed to download bundle: ${response.status} ${response.statusText}`, response.status, "BUNDLE_DOWNLOAD_FAILED");
        }
        const tarballBytes = new Uint8Array(await response.arrayBuffer());
        try {
            return await extractBundle(tarballBytes);
        }
        catch (err) {
            if (err instanceof MarketplaceError)
                throw err;
            throw new MarketplaceError("Failed to extract plugin bundle", undefined, "BUNDLE_EXTRACT_FAILED");
        }
    }
    async reportInstall(id, version) {
        // Generate a stable site hash from the site origin (best-effort, non-identifying)
        const siteHash = await generateSiteHash(this.siteOrigin);
        const url = `${this.baseUrl}/api/v1/plugins/${encodeURIComponent(id)}/installs`;
        try {
            await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ siteHash, version }),
            });
        }
        catch {
            // Fire-and-forget — never throw
        }
    }
    async searchThemes(query, opts) {
        const params = new URLSearchParams();
        if (query)
            params.set("q", query);
        if (opts?.keyword)
            params.set("keyword", opts.keyword);
        if (opts?.sort)
            params.set("sort", opts.sort);
        if (opts?.cursor)
            params.set("cursor", opts.cursor);
        if (opts?.limit)
            params.set("limit", String(opts.limit));
        const qs = params.toString();
        const url = `${this.baseUrl}/api/v1/themes${qs ? `?${qs}` : ""}`;
        return this.fetchJson(url);
    }
    async getTheme(id) {
        const url = `${this.baseUrl}/api/v1/themes/${encodeURIComponent(id)}`;
        return this.fetchJson(url);
    }
    async fetchJson(url) {
        let response;
        try {
            response = await fetch(url, {
                headers: { Accept: "application/json" },
            });
        }
        catch (err) {
            throw new MarketplaceUnavailableError(err);
        }
        if (!response.ok) {
            let errorMessage = `Marketplace request failed: ${response.status}`;
            try {
                const body = await response.json();
                if (body.error)
                    errorMessage = body.error;
            }
            catch {
                // use default message
            }
            throw new MarketplaceError(errorMessage, response.status);
        }
        const data = await response.json();
        return data;
    }
}
// ── Bundle extraction ──────────────────────────────────────────────
/**
 * Extract manifest + code files from a tarball.
 *
 * The tarball is a gzipped tar archive containing:
 * - manifest.json
 * - backend.js
 * - admin.js (optional)
 *
 * We use a minimal tar parser since we only need to read a few small files.
 */
/**
 * Exported so the experimental registry install handler can reuse the
 * same parse / validate / hash primitive. Despite the file name, this
 * function predates the marketplace-vs-registry split and is generic
 * over plugin bundle tarballs regardless of distribution channel.
 */
// Aligns with RFC 0001 §"Bundle size limits" (256 KiB decompressed,
// 20 files). Matches `MAX_BUNDLE_SIZE` in @emdash-cms/plugin-cli. We
// don't import that constant to keep this runtime module independent
// of the authoring CLI; the two values must stay in sync.
//
// Tar adds per-file headers (~512 bytes each) plus directory entries,
// so the entry count cap is set comfortably above RFC's 20-file limit.
// Going over either is a strong signal the bundle isn't a legitimate
// sandboxed plugin.
const MAX_DECOMPRESSED_BUNDLE_BYTES = 256 * 1024;
const MAX_BUNDLE_TAR_ENTRIES = 32;
export async function extractBundle(tarballBytes) {
    // Decompress fully into memory first, then parse the tar.
    // Passing a pipeThrough() stream directly to unpackTar causes a backpressure
    // deadlock in workerd: the tar decoder's body-stream pull() needs more
    // decompressed data, but the upstream pipe is stalled waiting for the
    // decoder's writable side to drain — a circular dependency.
    const decompressedStream = new ReadableStream({
        start(controller) {
            controller.enqueue(tarballBytes);
            controller.close();
        },
    }).pipeThrough(createGzipDecoder());
    // Collect decompressed bytes with a hard cap. A gzip-bomb -- a small
    // tarball that decompresses to gigabytes -- otherwise exhausts
    // worker / Node memory before we know to reject it. The cap matches
    // RFC 0001's publish-time bundle size limit (MAX_DECOMPRESSED_BUNDLE_BYTES);
    // anything past that isn't a legitimate sandboxed plugin.
    const reader = decompressedStream.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        if (!value)
            continue;
        total += value.byteLength;
        if (total > MAX_DECOMPRESSED_BUNDLE_BYTES) {
            try {
                await reader.cancel();
            }
            catch {
                // nothing to do
            }
            throw new MarketplaceError(`Bundle decompressed size exceeds limit (${MAX_DECOMPRESSED_BUNDLE_BYTES} bytes)`, undefined, "INVALID_BUNDLE");
        }
        chunks.push(value);
    }
    const decompressedBytes = new Uint8Array(total);
    {
        let offset = 0;
        for (const chunk of chunks) {
            decompressedBytes.set(chunk, offset);
            offset += chunk.byteLength;
        }
    }
    const decompressed = new ReadableStream({
        start(controller) {
            controller.enqueue(decompressedBytes);
            controller.close();
        },
    });
    const entries = await unpackTar(decompressed);
    if (entries.length > MAX_BUNDLE_TAR_ENTRIES) {
        throw new MarketplaceError(`Bundle has too many tar entries (${entries.length} > ${MAX_BUNDLE_TAR_ENTRIES})`, undefined, "INVALID_BUNDLE");
    }
    const decoder = new TextDecoder();
    const files = new Map();
    for (const entry of entries) {
        if (entry.data && entry.header.type === "file") {
            // Strip leading ./ prefix that tar tools commonly add
            const name = entry.header.name.replace(LEADING_DOT_SLASH, "");
            files.set(name, decoder.decode(entry.data));
        }
    }
    const manifestJson = files.get("manifest.json");
    const backendCode = files.get("backend.js");
    if (!manifestJson) {
        throw new MarketplaceError("Invalid bundle: missing manifest.json", undefined, "INVALID_BUNDLE");
    }
    if (!backendCode) {
        throw new MarketplaceError("Invalid bundle: missing backend.js", undefined, "INVALID_BUNDLE");
    }
    let manifest;
    try {
        const parsed = JSON.parse(manifestJson);
        const result = pluginManifestSchema.safeParse(parsed);
        if (!result.success) {
            throw new MarketplaceError("Invalid bundle: manifest.json failed validation", undefined, "INVALID_BUNDLE");
        }
        manifest = reconcileManifestAccess(result.data);
    }
    catch (err) {
        if (err instanceof MarketplaceError)
            throw err;
        throw new MarketplaceError("Invalid bundle: malformed manifest.json", undefined, "INVALID_BUNDLE");
    }
    // Compute SHA-256 checksum of the tarball for verification
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- Uint8Array is a valid BufferSource at runtime; TS lib mismatch
    const hashBuffer = await crypto.subtle.digest("SHA-256", tarballBytes);
    const hashArray = new Uint8Array(hashBuffer);
    const checksum = Array.from(hashArray, (b) => b.toString(16).padStart(2, "0")).join("");
    return {
        manifest,
        backendCode,
        adminCode: files.get("admin.js"),
        checksum,
    };
}
// ── Helpers ────────────────────────────────────────────────────────
/**
 * Generate a stable non-identifying site hash from the site origin.
 * The same origin always produces the same hash, so the marketplace
 * installs table deduplicates correctly per (plugin_id, site_hash).
 */
async function generateSiteHash(siteOrigin) {
    const seed = siteOrigin ? `emdash-site:${siteOrigin}` : `emdash-anonymous`;
    try {
        const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
        const arr = new Uint8Array(hash);
        return Array.from(arr.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
    }
    catch {
        // Fallback for environments without crypto.subtle: FNV-1a hash encoded as hex.
        // Deterministic, uniform distribution, no origin leakage.
        let h = 0x811c9dc5;
        for (let i = 0; i < seed.length; i++) {
            h ^= seed.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        const h2 = h ^ (h >>> 16);
        return (h >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
    }
}
// ── Factory ────────────────────────────────────────────────────────
/**
 * Create a MarketplaceClient for the given marketplace URL.
 *
 * @param baseUrl - The marketplace API base URL (e.g. "https://marketplace.emdashcms.com")
 * @param siteOrigin - The origin of the EmDash site (e.g. "https://myblog.example.com").
 *   Used to generate a stable, non-identifying site hash for install deduplication.
 */
export function createMarketplaceClient(baseUrl, siteOrigin) {
    return new MarketplaceClientImpl(baseUrl, siteOrigin);
}
