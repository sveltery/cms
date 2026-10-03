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
The same seven callbacks pass against native taxonomy development head
`3bdeb244156fdfcd58a973fbb19722ff2a01ac30`: they invoke its production
068/082/085 algorithms, taxonomy get/update handlers, and canonical native
registry/content repository for 068. The other six historical cases still use
the test-only source Runner to generate real historical prestate. There is
zero new assertion-red or causal TDD credit: those native algorithms already
existed. The uniform `_emdash_`→`_cms_` system namespace transformation is the
same disclosed host substitution used by the taxonomy suite; stored raw
callbacks and their expectation bodies are unchanged.

Reference local workerd/D1 passes six callbacks. The initial native run reported
six passes, but configured review found that the native 068 fixture silently
selected Node SQLite. That D1 credit is withdrawn: the verified initial native
count is five actual D1 passes, one mislabeled SQLite pass, and one unsupported
source fixture. An original transport guard executes a 100-binding query and
requires a 101-binding query to fail. Before the host repair, the canonical native
path accepts 101 bindings and causes one genuine supplemental assertion failure;
the direct historical path uses real workerd and passes. This is fixture TDD,
with zero source-declaration red or causal source TDD credit.

The native fixture repair uses the approved shared asynchronous D1 test storage
from actual main `34d4d2a1160e525eeab7f9eb0e973b3c1b513d0b`. Its real
CmsDatabase runs canonical `migrateCms`, registers both native database hosts,
and creates the standard collections/fields through the native SchemaRegistry.
Both original binding guards pass; the unchanged native 068 callback now passes
on actual workerd D1, restoring six real D1 passes with the same one 240-binding
source-fixture omission. No source assertion, callback, fixture SQL, transport
chunk, or deadline was changed. The original incorrect count remains recorded.
A reference rerun on the original synchronous host recorded a 068 beforeEach
STACK_TRACE_ERROR before assertions plus the known binding-limit fixture. The
complete prior failure is retained; an isolated unchanged 068 callback then
passed. Neither result proves the error's natural cause or earns assertion-red
credit. The approved asynchronous binding is now also below the unchanged pinned
RawBindingD1Dialect, D1Introspector, MigrationLock and complete Runner. Their
verified runtime binding consumers use only prepare/bind/all/batch; no other D1
API is fabricated. Complete reference and native workerd runs each pass six of
seven source callbacks and both original binding guards (8/9 total), failing
only the unchanged 240-binding fixture. These remain failed seven-case D1 runs.

The remaining definition-group callback inserts 30 historical rows with 240 bound
parameters in one statement. D1 rejects that original fixture before migration
085 or its assertions. The source's dialect selection is SQLite/PostgreSQL,
and the fixture remains unchanged: no chunked substitute, deadline increase,
source bug, assertion-red credit or whole seven-case D1 pass is claimed.
The complete pinned D1 dialect/introspector and `kysely-d1 0.4.0` supply the
reference migration host above the approved actual-Worker test transport. D1 algorithms run on Node over actual workerd SQL;
this is separate from native Cloudflare HTTP application evidence.

This fixture does not
implement an EmDash database importer, establish full legacy upgrade support,
execute PostgreSQL, or grant media, relation, block, transfer, authentication,
or other feature credit merely because their migration modules are loaded.
Normal frozen installation failed npm registry503 metadata verification and
is not claimed green. Installed-library typechecking reports 0 errors and 0 warnings.
Original head `f4c0ca8` hosted validate and browser jobs both failed; no full
normal/secured-browser pass is recorded. Final-approved-main integration, review,
project-manager approval, owned merge and post-merge verification remain pending.

For the separate native development integration, set
`SVELTERY_TAXONOMY_HISTORY_NATIVE_ROOT` to the verified native checkout. Set
`SVELTERY_TAXONOMY_HISTORY_TARGET=workerd-d1` for the complete seven-case D1
qualification run; its one fixture failure remains an honest failed run. The two
original transport guards also run in the normal Node history stages and earn
zero copied source-declaration credit.

See the [compatibility register](../parity/emdash/compatibility.md) for the
fixture boundary and the distinction between reference and product evidence.
