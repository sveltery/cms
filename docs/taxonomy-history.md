# Historical taxonomy migration fixtures

This bounded fixture executes all seven complete callbacks from the three
historical taxonomy migration test files at EmDash 1.1.0,
[`913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`](https://github.com/emdash-cms/emdash/commit/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e).
The [test ledger](taxonomy-history-ports.json) identifies every immutable
callback; the [source manifest](taxonomy-history-sources.json) identifies the
complete fixture modules and their source blobs. Copyright attribution and
the [MIT notice](../notices/emdash-MIT.txt) remain attached.

The tests were committed before the fixture. The initial unsynchronized Kit
configuration and subsequent missing fixture modules registered zero tests.
They are harness failures and earn zero assertion-red credit. After completing
the pinned fixture, all seven callbacks pass on Node SQLite. These are baseline
greens against the pinned implementation, not product regression fixes.

The fixture uses the complete source Runner and all 90 statically registered
migrations through `091_redirect_artifacts`. The source tests really migrate
to `081_redirect_write_guards` or `083_block_types`, insert their original
historical rows, and run the remaining actual source migrations. The returned
applied-version list comes from the Runner's execution results. The entry-group
test creates its standard collections and fields through the complete pinned
SchemaRegistry. No handwritten DDL or fabricated applied-version list replaces
those operations.

Only the test host is substituted: native Node SQLite or local Miniflare D1,
native test registration, TypeScript module resolution, the complete shared
admin slug helper, and the upstream core Vitest virtual-module defaults. Raw
test assertions and complete fixture modules remain unchanged beneath their
attribution headers. The provenance checker executes zero product tests:

```sh
node scripts/snapshot-taxonomy-history.mjs /path/to/pinned/emdash
pnpm exec vitest run --config vitest.taxonomy-history.config.ts
```

Pinned-reference execution is separate from native taxonomy product evidence.
The named native taxonomy integration is still pending. This fixture does not
implement an EmDash database importer, establish full legacy upgrade support,
execute PostgreSQL, or grant media, relation, block, transfer, authentication,
or other feature credit merely because their migration modules are loaded.
Local D1 execution and final-head normal/secured-browser checks remain pending.

See the [compatibility register](../parity/emdash/compatibility.md) for the
fixture boundary and the distinction between reference and product evidence.
