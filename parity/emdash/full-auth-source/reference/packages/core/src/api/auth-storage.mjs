/**
 * Auth provider storage helper.
 *
 * Gives auth provider routes access to plugin-style storage collections
 * namespaced under `auth:<providerId>`. Reuses the existing `_plugin_storage`
 * table and `PluginStorageRepository` infrastructure.
 */
import { createStorageAccess } from "../plugins/context.js";
/**
 * Get storage collections for an auth provider.
 *
 * Returns a record of `StorageCollection` instances, one per declared
 * collection in the provider's `storage` config. Data is stored in the
 * shared `_plugin_storage` table under the namespace `auth:<providerId>`.
 *
 * @example
 * ```ts
 * const storage = getAuthProviderStorage(emdash.db, "atproto", {
 *   states: { indexes: [] },
 *   sessions: { indexes: [] },
 * });
 * const session = await storage.sessions.get(sessionId);
 * ```
 */
export function getAuthProviderStorage(db, providerId, storageConfig) {
    return createStorageAccess(db, `auth:${providerId}`, storageConfig);
}
