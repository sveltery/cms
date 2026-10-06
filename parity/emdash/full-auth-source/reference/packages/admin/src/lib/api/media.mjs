/**
 * Media upload, list, delete, and provider APIs
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse, throwResponseError, } from "./client.js";
export const MEDIA_SEARCH_MAX_LENGTH = 200;
/** Trim and clamp a search term to the server-accepted range. */
export function normalizeMediaSearch(value) {
    return (value ?? "").trim().slice(0, MEDIA_SEARCH_MAX_LENGTH);
}
export class MediaUsageAccessDeniedError extends Error {
    constructor() {
        super("Media usage details are unavailable");
        this.name = "MediaUsageAccessDeniedError";
    }
}
/**
 * Fetch media list
 */
export async function fetchMediaList(options) {
    const params = new URLSearchParams();
    if (options?.cursor)
        params.set("cursor", options.cursor);
    if (options?.page !== undefined)
        params.set("page", String(options.page));
    if (options?.limit)
        params.set("limit", String(options.limit));
    if (options?.mimeType) {
        const value = Array.isArray(options.mimeType) ? options.mimeType.join(",") : options.mimeType;
        if (value)
            params.set("mimeType", value);
    }
    if (options?.folderId === null) {
        params.set("folderId", "unfiled");
    }
    else if (options?.folderId !== undefined) {
        params.set("folderId", options.folderId);
    }
    if (options?.search) {
        // Trim and clamp to the server's accepted range so a long or
        // whitespace-only term can't trigger an avoidable 400.
        const q = normalizeMediaSearch(options.search);
        if (q)
            params.set("q", q);
    }
    const url = `${API_BASE}/media${params.toString() ? `?${params}` : ""}`;
    const response = await apiFetch(url);
    return parseApiResponse(response, i18n._(msg `Failed to fetch media`));
}
/**
 * Fetch a single media item by id.
 *
 * Used to resolve an id-only reference (e.g. a byline's `avatarMediaId`)
 * back into a full media item for display.
 */
export async function fetchMediaItem(id, options) {
    const response = await apiFetch(`${API_BASE}/media/${encodeURIComponent(id)}`, {
        signal: options?.signal,
    });
    const data = await parseApiResponse(response, i18n._(msg `Failed to fetch media item`));
    return data.item;
}
export async function fetchMediaUsageDetails(mediaId, options) {
    const params = new URLSearchParams();
    if (options?.cursor !== undefined)
        params.set("cursor", options.cursor);
    if (options?.limit !== undefined)
        params.set("limit", String(options.limit));
    const query = params.toString();
    const response = await apiFetch(`${API_BASE}/media/${encodeURIComponent(mediaId)}/usage${query ? `?${query}` : ""}`, { signal: options?.signal });
    if (response.status === 401 || response.status === 403) {
        throw new MediaUsageAccessDeniedError();
    }
    return parseApiResponse(response, i18n._(msg `Failed to fetch media usage details`));
}
export async function fetchMediaFolders(options = {}) {
    const params = new URLSearchParams();
    if (options.limit !== undefined)
        params.set("limit", String(options.limit));
    if (options.cursor !== undefined)
        params.set("cursor", options.cursor);
    const search = normalizeMediaSearch(options.search);
    if (search)
        params.set("q", search);
    const query = params.toString();
    const response = await apiFetch(`${API_BASE}/media/folders${query ? `?${query}` : ""}`);
    return parseApiResponse(response, i18n._(msg `Failed to fetch media folders`));
}
export async function fetchMediaFolder(id) {
    const response = await apiFetch(`${API_BASE}/media/folders/${encodeURIComponent(id)}`);
    const data = await parseApiResponse(response, i18n._(msg `Failed to fetch media folder`));
    return data.item;
}
export async function createMediaFolder(name) {
    const response = await apiFetch(`${API_BASE}/media/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    const data = await parseApiResponse(response, i18n._(msg `Failed to create media folder`));
    return data.item;
}
export async function renameMediaFolder(id, name) {
    const response = await apiFetch(`${API_BASE}/media/folders/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    const data = await parseApiResponse(response, i18n._(msg `Failed to rename media folder`));
    return data.item;
}
export async function deleteMediaFolder(id) {
    const response = await apiFetch(`${API_BASE}/media/folders/${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete media folder`));
}
const MAX_CLIENT_HASH_BYTES = 8 * 1024 * 1024;
async function computeContentHash(file, signal) {
    signal?.throwIfAborted();
    const subtle = globalThis.crypto?.subtle;
    if (!subtle || file.size === 0 || file.size > MAX_CLIENT_HASH_BYTES)
        return undefined;
    try {
        const bytes = await file.arrayBuffer();
        signal?.throwIfAborted();
        const hash = await subtle.digest("SHA-1", bytes);
        signal?.throwIfAborted();
        const hex = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
        return `sha1:${hex}`;
    }
    catch {
        signal?.throwIfAborted();
        return undefined;
    }
}
/**
 * Try to get a signed upload URL
 * Returns null if signed URLs are not supported (e.g., local storage)
 */
async function getUploadUrl(file, opts) {
    try {
        const contentHash = opts?.deduplicate === false ? undefined : await computeContentHash(file, opts?.signal);
        const response = await apiFetch(`${API_BASE}/media/upload-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: opts?.signal,
            body: JSON.stringify({
                filename: file.name,
                contentType: file.type,
                size: file.size,
                ...(contentHash ? { contentHash } : {}),
                ...(opts?.fieldId ? { fieldId: opts.fieldId } : {}),
                ...(opts?.deduplicate === false ? { deduplicate: false } : {}),
                ...(opts?.ensureUniqueFilename ? { ensureUniqueFilename: true } : {}),
                ...(opts?.folderId !== undefined ? { folderId: opts.folderId } : {}),
            }),
        });
        if (response.status === 501) {
            // Not implemented - storage doesn't support signed URLs
            return null;
        }
        return parseApiResponse(response, i18n._(msg `Failed to get upload URL`));
    }
    catch (error) {
        opts?.signal?.throwIfAborted();
        // If the endpoint doesn't exist, fall back to direct upload
        if (error instanceof TypeError && error.message.includes("fetch")) {
            return null;
        }
        throw error;
    }
}
/**
 * Confirm upload after uploading to signed URL
 */
async function confirmUpload(mediaId, metadata, options) {
    const response = await apiFetch(`${API_BASE}/media/${mediaId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata || {}),
        signal: options?.signal,
    });
    const data = await parseApiResponse(response, i18n._(msg `Failed to confirm upload`));
    return data.item;
}
/**
 * Upload directly to signed URL
 */
async function uploadToSignedUrl(file, uploadInfo, options) {
    const headers = { ...uploadInfo.headers };
    if (file.type) {
        headers["Content-Type"] = file.type;
    }
    const response = await fetch(uploadInfo.uploadUrl, {
        method: uploadInfo.method,
        headers,
        body: file,
        signal: options?.signal,
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to upload file`));
}
/**
 * Get image dimensions from a file
 */
export async function getImageDimensions(file, options) {
    options?.signal?.throwIfAborted();
    if (!file.type.startsWith("image/")) {
        return null;
    }
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        const cleanup = () => {
            img.onload = null;
            img.onerror = null;
            options?.signal?.removeEventListener("abort", handleAbort);
            URL.revokeObjectURL(objectUrl);
        };
        const handleAbort = () => {
            cleanup();
            reject(options?.signal?.reason);
        };
        img.onload = () => {
            const dimensions = { width: img.naturalWidth, height: img.naturalHeight };
            cleanup();
            resolve(dimensions);
        };
        img.onerror = () => {
            cleanup();
            resolve(null);
        };
        options?.signal?.addEventListener("abort", handleAbort, { once: true });
        if (options?.signal?.aborted) {
            handleAbort();
            return;
        }
        img.src = objectUrl;
    });
}
function isVideoFile(file) {
    return file.type.startsWith("video/");
}
/**
 * Get video dimensions from a file.
 *
 * The browser reports oriented dimensions in `videoWidth`/`videoHeight` once
 * `loadedmetadata` fires, so phone videos with rotation metadata show the
 * display width/height rather than the encoded frame size.
 */
export async function getVideoDimensions(file, options) {
    options?.signal?.throwIfAborted();
    if (!isVideoFile(file)) {
        return null;
    }
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        const objectUrl = URL.createObjectURL(file);
        const cleanup = () => {
            video.removeEventListener("loadedmetadata", handleLoaded);
            video.removeEventListener("error", handleError);
            options?.signal?.removeEventListener("abort", handleAbort);
            video.src = "";
            video.load();
            URL.revokeObjectURL(objectUrl);
        };
        const handleLoaded = () => {
            const width = video.videoWidth;
            const height = video.videoHeight;
            cleanup();
            if (width && height) {
                resolve({ width, height });
            }
            else {
                resolve(null);
            }
        };
        const handleError = () => {
            cleanup();
            resolve(null);
        };
        const handleAbort = () => {
            cleanup();
            reject(options?.signal?.reason);
        };
        video.addEventListener("loadedmetadata", handleLoaded, { once: true });
        video.addEventListener("error", handleError, { once: true });
        options?.signal?.addEventListener("abort", handleAbort, { once: true });
        if (options?.signal?.aborted) {
            handleAbort();
            return;
        }
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.src = objectUrl;
        video.load();
    });
}
function getMediaDimensions(file, options) {
    if (file.type.startsWith("image/")) {
        return getImageDimensions(file, options);
    }
    if (isVideoFile(file)) {
        return getVideoDimensions(file, options);
    }
    return Promise.resolve(null);
}
/**
 * Upload media file via direct upload (legacy/local storage)
 */
async function uploadMediaDirect(file, opts) {
    // Get media dimensions before upload
    const dimensions = await getMediaDimensions(file, opts);
    const formData = new FormData();
    formData.append("file", file);
    // Send dimensions as form fields
    if (dimensions?.width)
        formData.append("width", String(dimensions.width));
    if (dimensions?.height)
        formData.append("height", String(dimensions.height));
    if (opts?.fieldId)
        formData.append("fieldId", opts.fieldId);
    if (opts?.deduplicate === false)
        formData.append("deduplicate", "false");
    if (opts?.ensureUniqueFilename)
        formData.append("ensureUniqueFilename", "true");
    if (opts?.folderId === null)
        formData.append("folderId", "unfiled");
    else if (opts?.folderId !== undefined)
        formData.append("folderId", opts.folderId);
    const response = await apiFetch(`${API_BASE}/media`, {
        method: "POST",
        body: formData,
        signal: opts?.signal,
    });
    const data = await parseApiResponse(response, i18n._(msg `Failed to upload media`));
    return data.item;
}
/**
 * Upload media file
 *
 * Tries signed URL upload first (for S3/R2 storage), falls back to direct upload
 * (for local storage) if signed URLs are not supported.
 */
export async function uploadMedia(file, opts) {
    opts?.signal?.throwIfAborted();
    // Try to get a signed upload URL
    const uploadInfo = await getUploadUrl(file, opts);
    if (!uploadInfo) {
        // Signed URLs not supported, use direct upload
        return uploadMediaDirect(file, opts);
    }
    if ("existing" in uploadInfo) {
        return fetchMediaItem(uploadInfo.mediaId, opts);
    }
    // Upload directly to storage via signed URL
    await uploadToSignedUrl(file, uploadInfo, opts);
    // Get media dimensions for confirmation
    const dimensions = await getMediaDimensions(file, opts);
    // Confirm the upload
    return confirmUpload(uploadInfo.mediaId, {
        size: file.size,
        width: dimensions?.width,
        height: dimensions?.height,
    }, opts);
}
export async function replaceMediaImage(id, file, dimensions, options) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("width", String(dimensions.width));
    formData.append("height", String(dimensions.height));
    const response = await apiFetch(`${API_BASE}/media/${encodeURIComponent(id)}/replace`, {
        method: "PUT",
        body: formData,
        signal: options?.signal,
    });
    const data = await parseApiResponse(response, i18n._(msg `Failed to replace media image`));
    return data.item;
}
/**
 * Delete media
 */
export async function deleteMedia(id) {
    const response = await apiFetch(`${API_BASE}/media/${id}`, {
        method: "DELETE",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete media`));
}
export async function updateMedia(id, input) {
    const response = await apiFetch(`${API_BASE}/media/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const data = await parseApiResponse(response, i18n._(msg `Failed to update media`));
    return data.item;
}
/**
 * Fetch all configured media providers
 */
export async function fetchMediaProviders() {
    const response = await apiFetch(`${API_BASE}/media/providers`);
    const data = await parseApiResponse(response, i18n._(msg `Failed to fetch media providers`));
    return data.items;
}
/**
 * Fetch media items from a specific provider
 */
export async function fetchProviderMedia(providerId, options) {
    const params = new URLSearchParams();
    if (options?.cursor)
        params.set("cursor", options.cursor);
    if (options?.limit)
        params.set("limit", String(options.limit));
    if (options?.query)
        params.set("query", options.query);
    if (options?.mimeType) {
        const value = Array.isArray(options.mimeType) ? options.mimeType.join(",") : options.mimeType;
        if (value)
            params.set("mimeType", value);
    }
    const url = `${API_BASE}/media/providers/${providerId}${params.toString() ? `?${params}` : ""}`;
    const response = await apiFetch(url);
    return parseApiResponse(response, i18n._(msg `Failed to fetch provider media`));
}
/**
 * Upload media to a specific provider
 */
export async function uploadToProvider(providerId, file, alt, options) {
    options?.signal?.throwIfAborted();
    const formData = new FormData();
    formData.append("file", file);
    if (alt)
        formData.append("alt", alt);
    const response = await apiFetch(`${API_BASE}/media/providers/${providerId}`, {
        method: "POST",
        body: formData,
        signal: options?.signal,
    });
    const data = await parseApiResponse(response, i18n._(msg `Failed to upload to provider`));
    return data.item;
}
/**
 * Delete media from a specific provider
 */
export async function deleteFromProvider(providerId, itemId) {
    const response = await apiFetch(`${API_BASE}/media/providers/${providerId}/${itemId}`, {
        method: "DELETE",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete from provider`));
}
