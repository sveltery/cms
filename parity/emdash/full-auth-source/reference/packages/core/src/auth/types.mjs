/**
 * Auth Provider Types
 *
 * Defines the interfaces for pluggable authentication providers.
 *
 * Two systems coexist:
 * - `AuthDescriptor` — transparent auth (Cloudflare Access) that authenticates
 *   every request via headers/cookies. No login UI needed.
 * - `AuthProviderDescriptor` — pluggable login methods (GitHub, Google,
 *   AT Protocol, etc.) that appear as options on the login page and setup
 *   wizard. Passkey is built-in; providers are additive.
 */
export {};
