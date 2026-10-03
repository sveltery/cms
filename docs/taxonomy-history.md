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
registry/content repository for068. The other six historical cases still use
the test-only source Runner to generate real historical prestate. There is
zero new assertion-red or causal TDD credit: those native algorithms already
existed. The uniform `_emdash_`→`_cms_` system namespace transformation is the
same disclosed host substitution used by the taxonomy suite; stored raw
callbacks and their expectation bodies are unchanged.

Actual local workerd/D1 passes six callbacks in both reference and native modes.
The remaining definition-group callback inserts30historical rows with240bound
parameters in one statement. D1 rejects that original fixture before migration
085 or its assertions. The source's dialect selection is SQLite/PostgreSQL,
and the fixture remains unchanged: no chunked substitute, deadline increase,
source bug, assertion-red credit or whole seven-case D1 pass is claimed.
The complete pinned D1 dialect/introspector and kysely-d10.4.0 supply the
reference migration host; the native canonical068 fixture uses its actual
CmsDatabase batch adapter. D1 algorithms run on Node over actual workerd SQL;
this is separate from native Cloudflare HTTP application evidence.

This fixture does not
implement an EmDash database importer, establish full legacy upgrade support,
execute PostgreSQL, or grant media, relation, block, transfer, authentication,
or other feature credit merely because their migration modules are loaded.
Normal frozen installation failed npm registry503 metadata verification and
is not claimed green. Installed-library typechecking reports0errors/0warnings.
Final-approved-main integration, normal/secured-browser checks, review,
project-manager approval, owned merge and post-merge verification remain pending.

For the separate native development integration, set
`SVELTERY_TAXONOMY_HISTORY_NATIVE_ROOT` to the verified native checkout. Set
`SVELTERY_TAXONOMY_HISTORY_TARGET=workerd-d1` for the complete seven-case D1
qualification run; its one fixture failure remains an honest failed run.

See the [compatibility register](../parity/emdash/compatibility.md) for the
fixture boundary and the distinction between reference and product evidence.
