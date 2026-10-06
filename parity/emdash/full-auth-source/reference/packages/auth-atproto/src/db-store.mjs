/**
 * Database-backed store for AT Protocol OAuth state and sessions.
 *
 * Wraps EmDash's plugin storage infrastructure to implement the `Store`
 * interface required by @atcute/oauth-node-client. Data is stored in the
 * shared `_plugin_storage` table under the `auth:atproto` namespace.
 *
 * Each store instance maps to a storage collection (e.g., "states" or
 * "sessions") and handles JSON serialization and TTL expiry checks.
 */
/**
 * Create a Store<K, V> backed by a StorageCollection.
 *
 * @param getCollection - Function returning the StorageCollection instance.
 *                        Using a getter because on Cloudflare Workers the db
 *                        binding (and thus the collection) changes per request.
 */
export function createDbStore(getCollection) {
    return {
        async get(key) {
            const entry = await getCollection().get(key);
            if (!entry)
                return undefined;
            // Check TTL
            if (entry.expiresAt && Date.now() > entry.expiresAt * 1000) {
                await getCollection().delete(key);
                return undefined;
            }
            return entry.value;
        },
        async set(key, value) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing to check optional expiresAt on opaque Store value type
            const expiresAt = value.expiresAt ?? null;
            await getCollection().put(key, { value, expiresAt });
        },
        async delete(key) {
            await getCollection().delete(key);
        },
        async clear() {
            // Query all items and delete them in batch
            const result = await getCollection().query({ limit: 10000 });
            if (result.items.length > 0) {
                await getCollection().deleteMany(result.items.map((i) => i.id));
            }
        },
    };
}
