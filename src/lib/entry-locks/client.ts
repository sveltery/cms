// Complete EmDash 1.1.0 entry-lock API functions. Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Native URL/error/localization host uses the existing actual browser client.
/**
 * Entry edit lock API
 */

import { translateEntryLock } from "./messages.ts";

import { API_BASE, apiFetch, parseApiResponse, ApiResponseError } from "../sections-widgets/client.ts";

export interface EntryLockHolder {
	userId: string;
	/** `null` when the holder's account has no display name set. */
	userName: string | null;
	acquiredAt: string;
	expiresAt: string;
}

export interface EntryLockStatus {
	/** Whether the collection takes edit locks at all. */
	enabled: boolean;
	holder: EntryLockHolder | null;
	heldByCaller: boolean;
}

function lockUrl(
	collection: string,
	id: string,
	query: { locale?: string; token?: string },
): string {
	const path = `${API_BASE}/content/${encodeURIComponent(collection)}/${encodeURIComponent(id)}/lock`;
	const params = new URLSearchParams();
	if (query.locale) params.set("locale", query.locale);
	if (query.token) params.set("token", query.token);
	const search = params.toString();
	return search ? `${path}?${search}` : path;
}

export async function acquireEntryLock(
	collection: string,
	id: string,
	options: { locale?: string; takeover?: boolean; token?: string } = {},
): Promise<EntryLockStatus> {
	const response = await apiFetch(lockUrl(collection, id, { locale: options.locale }), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			takeover: options.takeover ?? false,
			...(options.token ? { token: options.token } : {}),
		}),
	});
	return parseApiResponse<EntryLockStatus>(response, translateEntryLock("Failed to lock the entry"));
}

/**
 * `keepalive` lets the request outlive the page, for a release sent while the
 * tab is closing; its answer is never read.
 */
export async function releaseEntryLock(
	collection: string,
	id: string,
	options: { locale?: string; token?: string; keepalive?: boolean } = {},
): Promise<void> {
	const response = await apiFetch(
		lockUrl(collection, id, { locale: options.locale, token: options.token }),
		{ method: "DELETE", keepalive: options.keepalive === true },
	);
	if (options.keepalive) return;
	await parseApiResponse<{ released: boolean }>(
		response,
		translateEntryLock("Failed to release the entry lock"),
	);
}

/**
 * Reads the holder out of a refused write. Returns `null` for every other
 * failure, so callers can keep their existing error handling for those.
 */
export function entryLockRefusal(error: unknown): EntryLockHolder | null {
	if (!(error instanceof ApiResponseError) || error.code !== "ENTRY_LOCKED") return null;
	const details = error.details;
	if (!details || typeof details.userId !== "string") return null;
	return {
		userId: details.userId,
		userName: typeof details.userName === "string" ? details.userName : null,
		acquiredAt: typeof details.acquiredAt === "string" ? details.acquiredAt : "",
		expiresAt: typeof details.expiresAt === "string" ? details.expiresAt : "",
	};
}
