// Adapted from EmDash 1.1.0, MIT, Copyright 2026 Cloudflare Inc.
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/auth/src/types.ts:9
// See notices/emdash-MIT.txt.
export const Role = { SUBSCRIBER: 10, CONTRIBUTOR: 20, AUTHOR: 30, EDITOR: 40, ADMIN: 50 } as const;
export type RoleLevel = (typeof Role)[keyof typeof Role];
export interface SessionPrincipal { readonly id: string; readonly role: RoleLevel }
export function isRoleLevel(value: unknown): value is RoleLevel {
  return Object.values(Role).some((role) => role === value);
}
