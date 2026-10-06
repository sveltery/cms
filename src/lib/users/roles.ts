// Pinned complete ROLE_ENTRIES projection: packages/admin/src/components/users/roleDefinitions.ts.
// MIT Copyright 2026 Cloudflare Inc.; notices/emdash-MIT.txt. English native UI substitution.
export const USER_ROLES = [
  { value: 10, color: 'gray', label: 'Subscriber', description: 'Can view content' },
  { value: 20, color: 'blue', label: 'Contributor', description: 'Can create content' },
  { value: 30, color: 'green', label: 'Author', description: 'Can publish own content' },
  { value: 40, color: 'purple', label: 'Editor', description: 'Can manage all content' },
  { value: 50, color: 'red', label: 'Admin', description: 'Full access' }
] as const;
export function roleLabel(role: number) { return USER_ROLES.find(item => item.value === role)?.label ?? `Role ${role}`; }
