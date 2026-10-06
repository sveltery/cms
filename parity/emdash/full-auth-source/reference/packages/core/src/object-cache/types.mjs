/**
 * Object cache types
 *
 * The object cache is an optional, distributed read-through cache that sits
 * *beneath* the per-request cache (`requestCached`) and *above* the database.
 * Query results (content entries, settings, menus, taxonomies) are stored in a
 * fast key/value store (Cloudflare KV, or an in-isolate memory store for Node)
 * so repeat reads across requests and isolates skip the database entirely.
 *
 * Backends only ever deal in strings — serialization (including `Date`
 * preservation) is handled by the core read-through layer in `./codec.ts`, so
 * every backend behaves identically.
 */
export {};
