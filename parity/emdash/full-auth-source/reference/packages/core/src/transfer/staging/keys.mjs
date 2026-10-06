/**
 * Storage layout for staged packages.
 *
 * ```
 * transfers/imports/<operationId>-<secret>/<package path>
 * transfers/exports/<operationId>-<secret>/<package path>
 * transfers/<kind>/<operationId>-<secret>/_plan.json
 * ```
 *
 * `secret` is the operation's 128-bit `staging_secret`, so a staged object's
 * key cannot be guessed from an operation id. The public media route must
 * refuse every key under `transfers/` ({@link isTransferStorageKey}).
 */
import { TransferError } from "../errors.js";
import { isPackagePath } from "../format/paths.js";
export const TRANSFER_STORAGE_PREFIX = "transfers/";
/** Staged files that are not part of the package itself. */
export const STAGING_AUX_FILES = Object.freeze({
    plan: "_plan.json",
});
const OPERATION_ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const SECRET_PATTERN = /^[0-9a-f]{32}$/;
export function stagingPrefix(kind, operationId, stagingSecret) {
    if (!OPERATION_ID_PATTERN.test(operationId) || !SECRET_PATTERN.test(stagingSecret)) {
        throw new TransferError("TRANSFER_STORAGE_ERROR", "Invalid staging location");
    }
    return `${TRANSFER_STORAGE_PREFIX}${kind}s/${operationId}-${stagingSecret}/`;
}
/** Storage key of a package file under `prefix`. Rejects anything but a package path. */
export function stagingKey(prefix, path) {
    if (!isPackagePath(path)) {
        throw new TransferError("TRANSFER_PATH_INVALID", "Invalid package path", { detail: { path } });
    }
    return `${prefix}${path}`;
}
export function stagingAuxKey(prefix, file) {
    return `${prefix}${STAGING_AUX_FILES[file]}`;
}
/**
 * Normalize a storage key for prefix guards, or return null when the key is
 * not a plain relative key: a leading `/` or `\`, any backslash, an empty
 * segment, or a `.`/`..` segment. The result is lowercased because some
 * storage backends treat keys case-insensitively. Guards must refuse keys
 * this returns null for.
 */
export function normalizeStorageKeyForGuard(key) {
    if (key.length === 0 || key.includes("\\"))
        return null;
    const segments = key.split("/");
    for (const segment of segments) {
        if (segment === "" || segment === "." || segment === "..")
            return null;
    }
    return key.toLowerCase();
}
/** Prefixes the public media route must never serve. */
export const PRIVATE_STORAGE_PREFIXES = Object.freeze([
    "backups/",
    TRANSFER_STORAGE_PREFIX,
]);
/**
 * Whether a public route must refuse `key`: it is not a plain relative key
 * or it falls under one of `prefixes`.
 */
export function isRefusedStorageKey(key, prefixes = PRIVATE_STORAGE_PREFIXES) {
    const normalized = normalizeStorageKeyForGuard(key);
    return normalized === null || prefixes.some((prefix) => normalized.startsWith(prefix));
}
/**
 * Whether a storage key is (or may resolve to) transfer staging. Also true
 * for keys {@link normalizeStorageKeyForGuard} rejects.
 */
export function isTransferStorageKey(key) {
    return isRefusedStorageKey(key, [TRANSFER_STORAGE_PREFIX]);
}
