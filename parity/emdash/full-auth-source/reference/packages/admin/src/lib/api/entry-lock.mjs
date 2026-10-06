/**
 * Entry edit lock API
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse, ApiResponseError } from "./client.js";
function lockUrl(collection, id, query) {
    const path = `${API_BASE}/content/${encodeURIComponent(collection)}/${encodeURIComponent(id)}/lock`;
    const params = new URLSearchParams();
    if (query.locale)
        params.set("locale", query.locale);
    if (query.token)
        params.set("token", query.token);
    const search = params.toString();
    return search ? `${path}?${search}` : path;
}
export async function acquireEntryLock(collection, id, options = {}) {
    const response = await apiFetch(lockUrl(collection, id, { locale: options.locale }), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            takeover: options.takeover ?? false,
            ...(options.token ? { token: options.token } : {}),
        }),
    });
    return parseApiResponse(response, i18n._(msg `Failed to lock the entry`));
}
/**
 * `keepalive` lets the request outlive the page, for a release sent while the
 * tab is closing; its answer is never read.
 */
export async function releaseEntryLock(collection, id, options = {}) {
    const response = await apiFetch(lockUrl(collection, id, { locale: options.locale, token: options.token }), { method: "DELETE", keepalive: options.keepalive === true });
    if (options.keepalive)
        return;
    await parseApiResponse(response, i18n._(msg `Failed to release the entry lock`));
}
/**
 * Reads the holder out of a refused write. Returns `null` for every other
 * failure, so callers can keep their existing error handling for those.
 */
export function entryLockRefusal(error) {
    if (!(error instanceof ApiResponseError) || error.code !== "ENTRY_LOCKED")
        return null;
    const details = error.details;
    if (!details || typeof details.userId !== "string")
        return null;
    return {
        userId: details.userId,
        userName: typeof details.userName === "string" ? details.userName : null,
        acquiredAt: typeof details.acquiredAt === "string" ? details.acquiredAt : "",
        expiresAt: typeof details.expiresAt === "string" ? details.expiresAt : "",
    };
}
