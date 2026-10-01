import type { RoleLevel } from './roles.ts';
export type Permission = 'content:read' | 'content:read_drafts' | 'content:create' | 'content:edit_own' | 'content:edit_any' | 'users:manage' | 'schema:manage' | 'media:edit_own' | 'media:edit_any';
export function hasPermission(user: { role: RoleLevel } | null | undefined, permission: Permission): boolean { return false; }
export function requirePermission(user: { role: RoleLevel } | null | undefined, permission: Permission): void {}
export function canActOnOwn(user: { role: RoleLevel; id: string } | null | undefined, ownerId: string, ownPermission: Permission, anyPermission: Permission): boolean { return false; }
export function requirePermissionOnResource(user: { role: RoleLevel; id: string } | null | undefined, ownerId: string, ownPermission: Permission, anyPermission: Permission): void {}
export class PermissionError extends Error { readonly code: 'unauthorized' | 'forbidden'; constructor(code: 'unauthorized' | 'forbidden', message: string) { super(message); this.name = 'PermissionError'; this.code = code; } }
