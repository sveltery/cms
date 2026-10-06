/**
 * Authorization helpers for API routes
 *
 * Thin wrappers around @emdash-cms/auth RBAC that return HTTP responses.
 * Auth middleware handles authentication; these handle authorization.
 */
import { hasPermission, canActOnOwn, hasScope } from "@emdash-cms/auth";
import { apiError } from "./error.js";
export function canReadMediaUsageCount(user, tokenScopes) {
    return (hasPermission(user, "content:read_drafts") && (!tokenScopes || hasScope(tokenScopes, "admin")));
}
/**
 * Check if user has a permission. Returns a 401/403 Response if not, or null if authorized.
 *
 * Usage:
 * ```ts
 * const denied = requirePerm(user, "schema:manage");
 * if (denied) return denied;
 * ```
 */
export function requirePerm(user, permission) {
    if (!user) {
        return apiError("UNAUTHORIZED", "Authentication required", 401);
    }
    if (!hasPermission(user, permission)) {
        return apiError("FORBIDDEN", "Insufficient permissions", 403);
    }
    return null;
}
/**
 * Check if user can act on a resource, considering ownership.
 * Returns a 401/403 Response if not, or null if authorized.
 *
 * Usage:
 * ```ts
 * const denied = requireOwnerPerm(user, item.authorId, "content:edit_own", "content:edit_any");
 * if (denied) return denied;
 * ```
 */
export function requireOwnerPerm(user, ownerId, ownPermission, anyPermission) {
    if (!user) {
        return apiError("UNAUTHORIZED", "Authentication required", 401);
    }
    if (!canActOnOwn(user, ownerId, ownPermission, anyPermission)) {
        return apiError("FORBIDDEN", "Insufficient permissions", 403);
    }
    return null;
}
/**
 * Like {@link requirePerm}, but authorized when the user has any of
 * `permissions`.
 */
export function requireAnyPerm(user, permissions) {
    if (!user) {
        return apiError("UNAUTHORIZED", "Authentication required", 401);
    }
    if (!permissions.some((permission) => hasPermission(user, permission))) {
        return apiError("FORBIDDEN", "Insufficient permissions", 403);
    }
    return null;
}
