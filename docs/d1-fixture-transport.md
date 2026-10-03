# Asynchronous local D1 test transport

The shared [schema-admin storage fixture](../tests/helpers/schema-admin-storage.ts)
uses `Miniflare.dispatchFetch` to a test-only Worker. The Worker prepares the
actual `env.DB` statements and calls `.all()` or exactly one `env.DB.batch()`.
No application adapter, existing source callback, canonical lifecycle assertion,
deadline, migration, database name, persistence directory or browser sandbox
setting changes. This harness substitution earns zero additional EmDash parity.

The previous fixture obtained `Miniflare.getD1Database('DB')`. Miniflare
4.20260507.1 proxies its synchronous properties/methods through a Worker that
posts a response, stores a shared completion flag, then calls `Atomics.notify`.
Its caller waits once and receives one response, asserting the response ID.
If the caller observes the store before the notify and begins its next wait,
the old notify can wake the new request before that request has a response.

[The original native scheduler regression](../tests/d1-transport.test.ts) executes
the installed Miniflare Worker body without changing any dependency file. Its
test-only wrapper delays the old notification at precisely that boundary. At
test-first commit `61045ba`, the real D1 query fails inside `SynchronousFetcher`
with `(message?.id === id)`. Commit `769be32` adds a second completed assertion
failure: the shared fixture calls `Atomics.wait` 15 times instead of zero. The
parameter/rollback and persisted-restart controls already pass at that baseline.
These are original harness regressions, not copied source declarations.

The same Miniflare response-ID assertion appears in the normal validate job for
[auth PR #48](https://github.com/sveltery/cms/pull/48), head
`059b158b49ca27a870f06212832e748b562b64e5`,
[run 37095494891](https://github.com/sveltery/cms/actions/runs/37095494891).
That job records 892 service passes and one failure while reading a lifecycle
snapshot. The controlled reproduction establishes a possible transport
interleaving; it does **not** establish the exact timing of the hosted failure.
The unchanged isolated canonical case also passed before this repair.

The [asynchronous helper](../tests/helpers/async-d1-storage.ts) transports values
with the existing pinned devalue 5.9.4 package. Its unchanged package modules
run in both Node and the Worker. It preserves null, strings (including NUL),
numbers, booleans, byte arrays, Uint8Array and ArrayBuffer. Actual D1 still rejects
undefined, bigint, objects, Date and boxed numbers; the native regression checks
their errors and unchanged rows. D1 error names, messages and causes cross the
boundary. Metadata, zero affected-row mapping and platform-owned `_cf_METADATA`
remain actual D1 results. Failed DDL/DML batches roll back together.

Kysely still uses the application's unchanged raw binding adapter. The helper
implements only that adapter's `prepare/bind/all/batch` subset. It provides no
`first/raw/run/exec`, sessions, bookmarks, replication or deployed D1 claim.
Each fixture owns its real runtime, shares one disposal promise between close
calls, and disposes after closing Kysely even if Kysely close fails. Persistent
fixtures reuse the actual supplied D1 directory; independent fixtures remain
isolated.

At implementation commit `6c4e859`, five diagnostic/control cases pass. The direct
Miniflare control continues to reproduce the delayed notification; the repaired
fixture performs zero synchronous waits. The unchanged
`lifecycle-owned-fts.test.ts` and `required-scalar-validation.test.ts` suites pass
all 22 cases with zero cancellations and their original deadlines. These focused
installed-dependency runs are not a normal frozen bootstrap or full hosted pass.
Exact-head normal validation, secured browser CI, independent/configured review,
PM approval and merge remain required. Other fixtures using `getD1Database`
directly retain their existing transport and limits.
