# Asynchronous local D1 test transport

The shared [schema-admin storage fixture](../tests/helpers/schema-admin-storage.ts)
uses `Miniflare.dispatchFetch` to a test-only Worker. The Worker prepares the
actual `env.DB` statements and calls `.all()` or exactly one `env.DB.batch()`.
No application adapter, existing source callback, canonical lifecycle assertion,
deadline, migration, persistence directory or browser sandbox
setting changes. Proposed fresh-fixture runtime pooling below changes only the
test-only ephemeral database identifiers. This harness substitution earns zero additional EmDash parity.

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
Each fixture owns its binding and disposal lifecycle. The storage wrapper shares
one disposal promise between close calls and closes Kysely before releasing its
fixture, including when Kysely close fails. Persistent fixtures reuse the actual
supplied D1 directory; independent fixtures remain isolated. The proposed pooling
below shares the runtime only for fresh ephemeral fixtures.

At implementation commit `6c4e859`, five diagnostic/control cases pass. The direct
Miniflare control continues to reproduce the delayed notification; the repaired
fixture performs zero synchronous waits. The unchanged
`lifecycle-owned-fts.test.ts` and `required-scalar-validation.test.ts` suites pass
all 22 cases with zero cancellations and their original deadlines. These focused
installed-dependency runs are not a normal frozen bootstrap or full hosted pass.
Exact-head normal validation, secured browser CI, independent/configured review,
PM approval and merge remain required. Other fixtures using `getD1Database`
directly retain their existing transport and limits.


## Proposed bounded runtime reuse for fresh fixtures

The native shared fixture currently starts a new Miniflare runtime for every
fresh database. The proposed test-only helper groups at most 256 distinct D1
bindings under one real Miniflare/workerd process. Every lease consumes one
UUID-qualified database identifier exactly once. It never clears, resets or
reassigns a database to another fixture. A closed lease rejects further queries,
and disposal drains its already-started requests before releasing the lease.
Exhausted groups close after their final lease; an idle current group closes
after 250 ms so it cannot keep a finished test file alive.

Persistent fixtures retain a dedicated new runtime, the original
`cms-schema-admin` database identifier and the exact supplied directory. Product
adapters, providers 1–8, all existing callback/assertion/fixture matrices, bootstrap
commands and deadlines remain unchanged. This native harness substitution earns
zero additional EmDash parity or deployed-D1 support.

The [whole native runtime requirements](../tests/d1-fixture-runtime-reuse.test.ts)
record four callbacks. At test-first head `ae06f004`, two completed failures compare
distinct simultaneously-live runtime endpoints, while physical database
isolation, peer survival after close and persistent restart controls already
pass. The 256-boundary matrix is unreached at that baseline failure. An earlier
file-count fixture incorrectly included Miniflare's `metadata.sqlite` catalog;
that setup error earns zero causal credit. Earlier duplicate raw-runtime disposal
attempts left the runner unfinished and earn no completed-run credit.

The unchanged five-case transport suite also passes at that baseline. An isolated
local 100-fixture create/insert/read characterization observes 100 actual
Miniflare instances in 7314.85 ms. OS port reuse makes sequential endpoint counts
unsuitable for counting runtimes. This is local fixture cost evidence, not a
whole-validation result or proof of the hosted slowdown's cause. At helper commit `d21c3bca`, the complete native four and existing five
transport callbacks pass. The same 100-fixture characterization observes one
actual runtime in 1379.29 ms, compared with 100 runtimes in 7314.85 ms at baseline.
These separate local measurements establish a fixture-startup reduction under
this environment; they do not establish full-suite or hosted causation.

The owned test setup then refactors repeated pair acquisition into one helper
that closes the first lease if the second fails to start. All four titles and 15
assertion expressions remain byte-identical; whole nine callbacks pass after
refactor with zero failures, cancellations, skips or todos. Production helper
bytes and all existing Source/native test files remain unchanged by refactor.
Root authorized only the exact helper development candidate (6486 bytes), SHA
`a0705209c4bec16849bade728a8a044fdeb20d42a8e0935a373314fb4942758a`,
before application. Whole normal/secured CI and final review remain pending. Idle cleanup, startup failure and pending-close drain have
static-review coverage only. Specific PM acceptance and landing are pending.
