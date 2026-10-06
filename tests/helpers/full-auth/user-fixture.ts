// Entire makeUser fixture from pinned packages/admin/tests/components/users/UserDetail.test.tsx.
// MIT Copyright 2026 Cloudflare Inc.; notices/emdash-MIT.txt. Native DOM fixtures only.
export function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1', email: 'test@example.com', name: 'Test User', avatarUrl: null,
    role: 30, emailVerified: true, disabled: false,
    createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-02T00:00:00Z',
    lastLogin: '2025-01-02T00:00:00Z', credentialCount: 1, oauthProviders: [],
    credentials: [{ id: 'cred-1', name: 'My Passkey', deviceType: 'multiDevice',
      createdAt: '2025-01-01T00:00:00Z', lastUsedAt: '2025-01-02T00:00:00Z' }],
    oauthAccounts: [], ...overrides
  };
}
