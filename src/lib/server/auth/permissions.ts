// Adapted from EmDash 1.1.0, MIT, Copyright 2026 Cloudflare Inc.
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/auth/src/rbac.ts
// See notices/emdash-MIT.txt. API token scope helpers remain deferred.
/**
 * Role-Based Access Control
 */

import { Role, isRoleLevel, type RoleLevel } from "./roles.ts";

/**
 * Permission definitions with minimum role required
 */
export const Permissions = Object.freeze({
	// Content
	"content:read": Role.SUBSCRIBER,
	// content:read_drafts gates non-published content (drafts, scheduled, trash)
	// and editor-only views (revisions, compare, preview-url). Subscribers may
	// hold content:read for member-only published content but must not see
	// drafts.
	"content:read_drafts": Role.CONTRIBUTOR,
	"content:create": Role.CONTRIBUTOR,
	"content:edit_own": Role.AUTHOR,
	"content:edit_any": Role.EDITOR,
	"content:delete_own": Role.AUTHOR,
	"content:delete_any": Role.EDITOR,
	// Permanent deletion (empty trash) is irreversible and bypasses the
	// soft-delete safety net, so it sits at the same authorization tier as
	// other destructive system actions (schema:manage, comments:delete).
	"content:delete_permanent": Role.ADMIN,
	"content:publish_own": Role.AUTHOR,
	"content:publish_any": Role.EDITOR,

	// Media
	"media:read": Role.SUBSCRIBER,
	"media:upload": Role.CONTRIBUTOR,
	"media:edit_own": Role.AUTHOR,
	"media:edit_any": Role.EDITOR,
	"media:delete_own": Role.AUTHOR,
	"media:delete_any": Role.EDITOR,

	// Taxonomies
	"taxonomies:read": Role.SUBSCRIBER,
	"taxonomies:manage": Role.EDITOR,

	// Comments
	"comments:read": Role.SUBSCRIBER,
	"comments:moderate": Role.EDITOR,
	"comments:delete": Role.ADMIN,
	"comments:settings": Role.ADMIN,

	// Menus
	"menus:read": Role.SUBSCRIBER,
	"menus:manage": Role.EDITOR,

	// Bylines
	"bylines:read": Role.SUBSCRIBER,
	"bylines:manage": Role.EDITOR,

	// Widgets
	"widgets:read": Role.SUBSCRIBER,
	"widgets:manage": Role.EDITOR,

	// Sections
	"sections:read": Role.SUBSCRIBER,
	"sections:manage": Role.EDITOR,

	// Redirects
	"redirects:read": Role.EDITOR,
	"redirects:manage": Role.ADMIN,

	// Users
	"users:read": Role.ADMIN,
	"users:invite": Role.ADMIN,
	"users:manage": Role.ADMIN,

	// Settings
	"settings:read": Role.EDITOR,
	"settings:manage": Role.ADMIN,

	// Schema (content types)
	"schema:read": Role.EDITOR,
	"schema:manage": Role.ADMIN,

	// Plugins
	"plugins:read": Role.EDITOR,
	"plugins:manage": Role.ADMIN,

	// Import
	"import:execute": Role.ADMIN,

	// Backups (full content export — admin-only, same tier as settings:manage)
	"backups:manage": Role.ADMIN,

	// Site transfer (whole-site export, and import into an empty site)
	"transfer:export": Role.ADMIN,
	"transfer:import": Role.ADMIN,

	// Core update notice
	"updates:read": Role.ADMIN,

	// Search
	"search:read": Role.SUBSCRIBER,
	"search:manage": Role.ADMIN,

	// Auth
	"auth:manage_own_credentials": Role.SUBSCRIBER,
	"auth:manage_connections": Role.ADMIN,
} as const);

export type Permission = keyof typeof Permissions;

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
	user: { role: RoleLevel } | null | undefined,
	permission: Permission,
): boolean {
	if (!user || !isRoleLevel(user.role) || !Object.hasOwn(Permissions, permission)) return false;
	return user.role >= Permissions[permission];
}

/**
 * Require a permission, throwing if not met
 */
export function requirePermission(
	user: { role: RoleLevel } | null | undefined,
	permission: Permission,
): asserts user is { role: RoleLevel } {
	if (!user) {
		throw new PermissionError("unauthorized", "Authentication required");
	}
	if (!hasPermission(user, permission)) {
		throw new PermissionError("forbidden", `Missing permission: ${permission}`);
	}
}

/**
 * Check if user can perform action on a resource they own
 */
export function canActOnOwn(
	user: { role: RoleLevel; id: string } | null | undefined,
	ownerId: string,
	ownPermission: Permission,
	anyPermission: Permission,
): boolean {
	if (!user) return false;
	// Defense in depth: an empty-string ownerId means "no recorded owner"
	// (e.g. seed-imported content with `authorId: null` extracted to ""),
	// not "owned by an unauthenticated user". If both the user.id and the
	// ownerId are "", treating them as a match would accidentally grant
	// edit-own — fall through to the any-permission check instead.
	if (ownerId !== "" && user.id === ownerId) {
		return hasPermission(user, ownPermission);
	}
	return hasPermission(user, anyPermission);
}

/**
 * Require permission on a resource, checking ownership
 */
export function requirePermissionOnResource(
	user: { role: RoleLevel; id: string } | null | undefined,
	ownerId: string,
	ownPermission: Permission,
	anyPermission: Permission,
): asserts user is { role: RoleLevel; id: string } {
	if (!user) {
		throw new PermissionError("unauthorized", "Authentication required");
	}
	if (!canActOnOwn(user, ownerId, ownPermission, anyPermission)) {
		throw new PermissionError("forbidden", `Missing permission: ${anyPermission}`);
	}
}

export class PermissionError extends Error {
	readonly code: "unauthorized" | "forbidden";
	constructor(
		code: "unauthorized" | "forbidden",
		message: string,
	) {
		super(message);
		this.name = "PermissionError";
		this.code = code;
	}
}
