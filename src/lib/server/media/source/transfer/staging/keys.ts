// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Exact selected public-key helper closure from 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/transfer/staging/keys.ts.


export const TRANSFER_STORAGE_PREFIX = "transfers/";


/**
 * Normalize a storage key for prefix guards, or return null when the key is
 * not a plain relative key: a leading `/` or `\`, any backslash, an empty
 * segment, or a `.`/`..` segment. The result is lowercased because some
 * storage backends treat keys case-insensitively. Guards must refuse keys
 * this returns null for.
 */
export function normalizeStorageKeyForGuard(key: string): string | null {
	if (key.length === 0 || key.includes("\\")) return null;
	const segments = key.split("/");
	for (const segment of segments) {
		if (segment === "" || segment === "." || segment === "..") return null;
	}
	return key.toLowerCase();
}


/** Prefixes the public media route must never serve. */
export const PRIVATE_STORAGE_PREFIXES: readonly string[] = Object.freeze([
	"backups/",
	TRANSFER_STORAGE_PREFIX,
]);


/**
 * Whether a public route must refuse `key`: it is not a plain relative key
 * or it falls under one of `prefixes`.
 */
export function isRefusedStorageKey(
	key: string,
	prefixes: readonly string[] = PRIVATE_STORAGE_PREFIXES,
): boolean {
	const normalized = normalizeStorageKeyForGuard(key);
	return normalized === null || prefixes.some((prefix) => normalized.startsWith(prefix));
}


/**
 * Whether a storage key is (or may resolve to) transfer staging. Also true
 * for keys {@link normalizeStorageKeyForGuard} rejects.
 */
export function isTransferStorageKey(key: string): boolean {
	return isRefusedStorageKey(key, [TRANSFER_STORAGE_PREFIX]);
}