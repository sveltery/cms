/**
 * Auth provider storage accessor.
 *
 * Resolves the atproto auth provider's storage collections from the
 * EmDash runtime config. Used by route handlers to get storage for
 * the OAuth client.
 */
/**
 * Get the auth provider storage collections for the atproto provider.
 * Returns null if the provider has no storage declared or is not found.
 */
export async function getAtprotoStorage(emdash) {
    const { getAuthProviderStorage } = await import("emdash/api/route-utils");
    const provider = emdash.config.authProviders?.find((p) => p.id === "atproto");
    if (!provider?.storage)
        return null;
    return getAuthProviderStorage(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Kysely<unknown> satisfies getAuthProviderStorage's Database parameter
    emdash.db, "atproto", 
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- provider.storage shape matches getAuthProviderStorage's expected Record type
    provider.storage);
}
