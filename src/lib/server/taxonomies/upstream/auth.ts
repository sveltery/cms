// Native current-role RBAC seam. Token scope helper from exact pin auth/tokens.ts:106.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt; no token product credit.
export * from '../../auth/roles.ts';
export * from '../../auth/permissions.ts';
export type {Permission} from '../../database/service.ts';
const IMPLICIT_SCOPE_GRANTS = new Map<string, readonly string[]>([
 ["content:write", ["menus:manage", "taxonomies:manage"]],
]);
export function hasScope(scopes: string[], required: string): boolean {
 if (required === "mcp:tools" || required.startsWith("mcp:tools:")) {
  return scopes.includes("mcp:tools") || scopes.includes(required);
 }
 if (scopes.includes("admin")) return true;
 if (scopes.includes(required)) return true;
 for (const held of scopes) {
  const granted = IMPLICIT_SCOPE_GRANTS.get(held);
  if (granted?.includes(required)) return true;
 }
 return false;
}
