/**
 * Programmatic media upload handler (MCP `media_upload` tool).
 *
 * Accepts file bytes as base64, then runs the same pipeline as the multipart
 * REST upload route: allowlist + size validation, content-hash deduplication,
 * storage upload, image metadata enrichment, and record creation.
 */
import * as path from "node:path";
import { ulid } from "ulidx";
import { MediaRepository } from "../../database/repositories/media.js";
import { enrichImageMetadata } from "../../media/enrich.js";
import { matchesMimeAllowlist, normalizeMime, resolveUploadMimeType } from "../../media/mime.js";
import { decodeBase64Bytes } from "../../utils/base64.js";
import { computeContentHash } from "../../utils/hash.js";
import { CONTENT_TYPE_RE, DEFAULT_MAX_UPLOAD_SIZE, formatFileSize } from "../schemas/media.js";
import { GLOBAL_UPLOAD_ALLOWLIST } from "./media-allowlist.js";
function fail(code, message) {
    return { success: false, error: { code, message } };
}
/** Same relative-URL shape the REST media routes return. */
function withUrl(item) {
    return { ...item, url: `/_emdash/api/media/file/${item.storageKey}` };
}
/** Decode the file bytes after rejecting an oversized encoded payload. */
async function acquireBytes(input, maxUploadSize) {
    // Cheap size precheck on the encoded string (decoded size is ~3/4 of
    // the base64 length) before allocating the decoded buffer.
    if ((input.base64.length * 3) / 4 > maxUploadSize) {
        return fail("PAYLOAD_TOO_LARGE", `File exceeds maximum size of ${formatFileSize(maxUploadSize)}`);
    }
    try {
        return { bytes: decodeBase64Bytes(input.base64), mimeType: input.contentType };
    }
    catch {
        return fail("VALIDATION_ERROR", "Invalid base64 data");
    }
}
/**
 * Upload a media file from base64 data.
 *
 * Mirrors the REST `POST /_emdash/api/media` route: global MIME allowlist,
 * size limit, content-hash dedupe (returns the existing item with
 * `deduplicated: true`), storage upload with cleanup on failure, and
 * image metadata enrichment (dimensions, blurhash, dominant color).
 */
export async function handleMediaUpload(db, storage, input, hooks = {}) {
    if (!input.base64 || !input.contentType) {
        return fail("VALIDATION_ERROR", "base64 and contentType are required");
    }
    const rawMax = input.maxUploadSize ?? DEFAULT_MAX_UPLOAD_SIZE;
    if (!Number.isFinite(rawMax) || rawMax <= 0) {
        return fail("CONFIGURATION_ERROR", "Invalid maxUploadSize configuration");
    }
    const acquired = await acquireBytes(input, rawMax);
    if ("success" in acquired)
        return acquired;
    const { bytes } = acquired;
    let filename = input.filename;
    // Resolve from the supplied content type where possible, but fall back to
    // the filename extension so callers that can't identify a format such as
    // JPEG XL (e.g. empty or generic `application/octet-stream`) still work.
    let mimeType = resolveUploadMimeType(filename, acquired.mimeType);
    let size = bytes.byteLength;
    // Re-validate the resolved type here: the resolved value is either the
    // client-supplied type (parameters already stripped) or a value from the
    // internal extension map, so a crafted Content-Type with header injection
    // cannot reach the storage backend or the file-serving response.
    if (!CONTENT_TYPE_RE.test(mimeType)) {
        return fail("VALIDATION_ERROR", "Invalid content type");
    }
    if (!matchesMimeAllowlist(mimeType, GLOBAL_UPLOAD_ALLOWLIST)) {
        return fail("INVALID_TYPE", "File type not allowed");
    }
    if (bytes.byteLength > rawMax) {
        return fail("PAYLOAD_TOO_LARGE", `File exceeds maximum size of ${formatFileSize(rawMax)}`);
    }
    try {
        if (hooks.beforeUpload) {
            const processed = await hooks.beforeUpload({
                name: filename,
                type: mimeType,
                size: bytes.byteLength,
            });
            filename = processed.name;
            mimeType = normalizeMime(processed.type);
            size = processed.size;
            if (!CONTENT_TYPE_RE.test(processed.type)) {
                return fail("VALIDATION_ERROR", "Invalid content type");
            }
            if (!matchesMimeAllowlist(mimeType, GLOBAL_UPLOAD_ALLOWLIST)) {
                return fail("INVALID_TYPE", "File type not allowed");
            }
        }
        const contentHash = await computeContentHash(bytes);
        const repo = new MediaRepository(db);
        const existing = await repo.findByContentHash(contentHash);
        if (existing) {
            return { success: true, data: { item: withUrl(existing), deduplicated: true } };
        }
        const storageKey = `${ulid()}${path.extname(filename)}`;
        await storage.upload({ key: storageKey, body: bytes, contentType: mimeType });
        try {
            const enriched = await enrichImageMetadata(bytes, mimeType);
            const item = await repo.create({
                filename,
                mimeType,
                size,
                width: enriched.width,
                height: enriched.height,
                alt: input.alt,
                caption: input.caption,
                storageKey,
                contentHash,
                blurhash: enriched.blurhash,
                dominantColor: enriched.dominantColor,
                authorId: input.authorId,
            });
            return { success: true, data: { item: withUrl(item) } };
        }
        catch (error) {
            // Don't leave an orphaned object in storage when record creation fails
            try {
                await storage.delete(storageKey);
            }
            catch {
                // Ignore cleanup errors
            }
            throw error;
        }
    }
    catch {
        return fail("UPLOAD_ERROR", "Upload failed");
    }
}
