/**
 * Microsoft OAuth Auth Provider
 *
 * Returns an AuthProviderDescriptor for Microsoft Entra ID login.
 * Credentials are read from environment variables at runtime.
 *
 * @example
 * ```ts
 * import { microsoft } from "emdash/auth/providers/microsoft";
 *
 * emdash({
 *   authProviders: [microsoft()],
 * })
 * ```
 */
/**
 * Configure Microsoft Entra ID as an auth provider.
 *
 * Requires `EMDASH_OAUTH_MICROSOFT_CLIENT_ID`, `EMDASH_OAUTH_MICROSOFT_CLIENT_SECRET`
 * and `EMDASH_OAUTH_MICROSOFT_TENANT_ID` (or `MICROSOFT_CLIENT_ID` /
 * `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID`) environment variables.
 */
export function microsoft(options = {}) {
    return {
        id: "microsoft",
        label: "Microsoft",
        config: options,
        adminEntry: "emdash/auth/providers/microsoft-admin",
    };
}
