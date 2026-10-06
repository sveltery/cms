/**
 * AT Protocol PDS Authentication Provider
 *
 * Config-time function that returns an AuthProviderDescriptor for use in astro.config.ts.
 * When configured, EmDash adds AT Protocol as a login option alongside passkey and
 * any other configured auth providers.
 *
 * @example
 * ```ts
 * import { atproto } from "@emdash-cms/auth-atproto";
 *
 * export default defineConfig({
 *   integrations: [
 *     emdash({
 *       authProviders: [
 *         atproto({ allowedDIDs: ["did:plc:abc123"] }),
 *       ],
 *     }),
 *   ],
 * });
 * ```
 */
/**
 * Configure AT Protocol PDS authentication as a pluggable auth provider.
 *
 * Users authenticate by signing in through their PDS's authorization page.
 * No passkeys or app passwords required — the user authenticates however
 * their PDS supports (password, passkey, etc.).
 *
 * @param config Optional configuration
 * @returns AuthProviderDescriptor for use in `emdash({ authProviders: [...] })`
 */
export function atproto(config) {
    return {
        id: "atproto",
        label: "Atmosphere",
        config: config ?? {},
        adminEntry: "@emdash-cms/auth-atproto/admin",
        routes: [
            {
                pattern: "/_emdash/api/auth/atproto/login",
                entrypoint: "@emdash-cms/auth-atproto/routes/login.ts",
            },
            {
                pattern: "/_emdash/api/auth/atproto/callback",
                entrypoint: "@emdash-cms/auth-atproto/routes/callback.ts",
            },
            {
                pattern: "/_emdash/api/setup/atproto-admin",
                entrypoint: "@emdash-cms/auth-atproto/routes/setup-admin.ts",
            },
            {
                // Served at root /.well-known/ (not /_emdash/) so PDS authorization
                // servers can fetch them quickly without hitting the EmDash middleware chain.
                pattern: "/.well-known/atproto-client-metadata.json",
                entrypoint: "@emdash-cms/auth-atproto/routes/client-metadata.ts",
            },
        ],
        publicRoutes: ["/_emdash/api/auth/atproto/"],
        storage: {
            states: { indexes: [] },
            sessions: { indexes: [] },
        },
    };
}
