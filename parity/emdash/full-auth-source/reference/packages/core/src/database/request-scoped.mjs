/**
 * Handles returned by the adapter's `createRequestScopedDb`. Some adapters
 * (D1 with sessions, Hyperdrive, Durable Object SQL with sessions or on
 * writes) build a new Kysely instance for each request or event, and every
 * one addresses the configured database, so a cache keyed by instance uses
 * `isRequestScopedDb` to treat them as one database. A database that other
 * code puts in the request context (playground, Durable Object preview) is
 * not registered.
 */
// On globalThis so Vite SSR chunk duplication cannot split the registry
// between the middleware that registers handles and the caches that read it.
const REQUEST_SCOPED_DBS_KEY = Symbol.for("emdash:request-scoped-dbs");
function getRegistry() {
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- globalThis singleton pattern
    const holder = globalThis;
    let registry = holder[REQUEST_SCOPED_DBS_KEY];
    if (!registry) {
        registry = new WeakSet();
        holder[REQUEST_SCOPED_DBS_KEY] = registry;
    }
    return registry;
}
export function markRequestScopedDb(db) {
    getRegistry().add(db);
}
export function isRequestScopedDb(db) {
    return getRegistry().has(db);
}
