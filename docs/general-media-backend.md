# General media backend

This prerequisite makes the pinned EmDash general media repositories, folders,
local storage and trusted R2 bindings available through the existing canonical
CMS database. It supplies native media list/item/multipart/folder/file/asset,
upload URL, streaming upload, confirmation and image replacement routes.
The unchanged Source fallback URLs under `/_emdash/api/media` are registered
for file bytes and the upload/confirm/replace transports. The backend has no
admin media library yet.

The behavior authority is EmDash 1.1.0
`913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`. The
[188 whole Source authorities](../parity/emdash/general-media-source/authority.json),
[whole test expression inventory](../parity/emdash/general-media-source/test-inventory.json),
[finite runtime import substitutions](../parity/emdash/general-media-source/runtime-transformations.json)
and [test-first receipts](general-media-tdd.json) preserve attribution and
actual scope. Static inventory: 81 whole test families, 800 declarations,
2,316 expectation roots, 131 mock declarations and 24 original clock calls.
Those numbers are not execution credit. The guard verifies complete native
module statements, the complete R2 class and seven complete usage read
functions against retained Source, with only recorded import substitutions.

## Canonical and hosting composition

`generalMediaDatabase` accepts only the actual trusted `CmsDatabase`. It maps
fixed media/folder/upload-attempt/field TableNodes to the existing provider 9
storage and composes the existing canonical options namespace adapter. It
changes no raw SQL, columns, values, results or migration catalog. The final
mapped owner is registered with the sole published block/media-usage host, so
unsupported D1 callback transactions fail closed through the existing boundary.
The sole published MediaUsageRepository remains the usage storage writer.
No provider, namespace installer, DDL or alternate database is added.

The trusted `cleanupMediaUploads` operator uses the exact complete Source
system-cleanup subsystem 3 and 4 try blocks. It removes abandoned pending
records/object bytes and orphan upload attempts while preserving a ready media
row sharing the same key. Only its three actual subsystem counts are returned.
The [two-block authority](../parity/emdash/general-media-source/cleanup-blocks.json)
retains both complete blocks and the whole original system-cleanup file. This
operator installs no cron and does not emulate Source `runSystemCleanup`; other
subsystem results and the full original stream/cleanup family remain unclaimed.

`cleanupGeneralMediaUsage` and the backend's `cleanupUsage` call the complete
pinned usage-cleanup algorithm through the sole published MediaUsageRepository.
The native wrapper initializes only the existing canonical `projection_gc`
metadata row using Source migration 061's task key and initial eligible time,
with `ON CONFLICT DO NOTHING`. This is operational initialization because the
canonical provider installs the schema without Source's migration data seed.
Existing lease, cursor and backoff state remains intact. It adds no occurrence
writer, cron, schema, provider or full content/plugin/transfer pipeline.

Trusted server configuration supplies a `Storage` instance through the existing
runtime presentation/request configuration. The final scoped D1 database spread
retains that instance, identity, session and waitUntil semantics. Node callers
can supply `LocalStorage`; Workers can supply `R2Storage` with their actual
trusted binding. The R2 class calls the supplied binding directly; an ambient
Web/Worker stream type contract changes no executable method body. No default
filesystem directory, bucket, credentials or Source `cloudflare:workers` env
factory is configured by this prerequisite. Environment provider construction
is available for configured Node/SQLite hosting through the trusted
`SVELTERY_MEDIA_DIRECTORY` option:

```sh
SVELTERY_DATABASE_PATH=./data/cms.db \
SVELTERY_MEDIA_DIRECTORY=./data/media \
SVELTERY_PUBLIC_ORIGIN=http://localhost:3000 \
ORIGIN=http://localhost:3000 pnpm start:node
```

Build the Node target first as documented in [Node hosting](node-hosting.md).
The trusted runtime derives public file URLs from the exact configured origin,
Kit base path and `/api/media/file`. The descriptor loads the Node-only provider
after origin/base validation, creates no default directory and never uses
forwarded headers. Explicitly injected storage retains precedence. A filesystem
option on D1/Worker configuration is rejected; scoped database, session, origin
and mutation gates remain unchanged. Omitting the option leaves storage absent.
Worker binding and S3 environment factories remain incomplete.

Native requests consume only the existing trusted principal and existing
mutation opt-in/origin guard. Read requires Subscriber, upload Contributor,
edit/delete own Author, and edit/delete any Editor. Anonymous private assets
are denied; public file routes retain the exact Source private-key, MIME,
attachment, sandbox and nosniff rules. Usage counts require the Source draft
read threshold; Subscriber summaries disclose coverage but no count. Actual
logo/favicon/default OG option references contribute to counts through the sole
usage repository. This does not implement PAT authentication.

## Actual test-first evidence

The first active 24 whole Source files produced 23 module stops and three
passing parser-security callbacks. Later route and pure-family additions also
first stopped at missing modules; they earn zero Source value-red or causal
TDD credit. Complete bodies, `.each` datasets, assertions, mocks and clocks are
unchanged. Current selection is 36 whole files with 321 passing callbacks,
plus the whole original R2 supplied-mock test with one passing callback.
Only the configured Source SQLite expansion runs; PostgreSQL is unconfigured.
The original S3 supplied-SDK mock family contributes 30 of those callbacks. The
complete pinned optional AWS declaration and S3 module are ported separately,
outside the default runtime graph; no actual SDK dependency/version or external
credential/signature/bucket/hosting evidence is claimed. The
genuine six-migration Source physical fixture is not the full Source runner
or canonical application startup.

Supplemental native workflows first expose unavailable canonical backend,
permission/storage composition, routes, R2 adapter, sequential upload and the
options namespace gap as genuine value assertions. The current 16 native
cases exercise actual canonical SQLite and local raw D1, reversible local file
bytes, actual local Miniflare R2 bytes, deduplication, folders, focal coordinates,
mutation/origin/ownership guards, public file URLs, private assets, pending
stream/confirmation, same-key replacement, settings usage counts and upload
cleanup on both canonical SQLite and raw D1. Native
route calls use controlled trusted principals directly; they do not establish
real protected HTTP/session/PAT acceptance. The R2 original mock establishes
no actual cloud hosting evidence. The local binding test provisions no external
bucket, signature or credential.

Two supplemental fixture mistakes remain explicit in the receipts: replacement
initially omitted mandatory dimensions and usage setup initially named a
nonexistent `autoload` column. The former returned 400; the latter stopped
before any expectation. Inputs were corrected to actual pinned contracts,
without altering Source bodies or product algorithms. Neither gives Source
causal credit. The independent audit's options namespace issue reached an
expected-200/actual-500 value assertion before the existing namespace adapter
was composed.

## Incomplete scope and acceptance

Full media usage refresh, repair, reconciliation, activation/work/deletion
processors, content/SEO/transfer/plugin integration and system cleanup remain
unfinished. Original stream-upload race/clock/cleanup and field-aware widening
families remain unlaunched pending their concrete owning dependency closure.
The pure extractor and seven usage read functions do not establish a complete
handler or lifecycle pipeline. Original full asset-auth/PAT tests, admin UI,
platform image service transforms, S3 hosting and PostgreSQL are not qualified.

After successful media deletion, bounded invalidation delegates only to the
sole published settings object-cache namespace. Source settings single-flight
and concrete request settings keys/readers are absent, so full settings cache
fidelity is not claimed. No additional cache/read facade is created.

The whole original thirteen-stage bootstrap at `bfc3d443` passed frozen install
and type checks, then failed service tests: 1,495 callbacks, 1,492 passed and
three failed, with zero cancellation/skip/todo. All failures are old native role
expectations that omit newly Source-required media permissions; ten later phases
were unreached. Five finite Native expectation sites across session-composition
and runtime-d1 (Author, Contributor, Admin count and two Subscriber arrays) have
a sealed unapplied proposal pending coordinator review. Reached reds and latent
unreached sites remain distinct; every Source expectation stays exact.

The same historical head completed all nine secured hosted browser launches in
[CI 530](https://github.com/sveltery/cms/actions/runs/37272293963), and fresh
independent review found no additional issue after the namespace fix. These
receipts do not qualify newer S3 changes. Current full gates, fresh independent
and configured review, exact coordinator approval, author regular merge and
post-main checks remain pending. Draft [PR #113](https://github.com/sveltery/cms/pull/113)
is open. App attachment was requested once; the request wait did not complete
and was stopped without retry, so attachment status is unverified. No complete
media roadmap checkbox or upstream parity is claimed.

### MED-D1-BUG01: shared pinned D1 cleanup limitation

The complete pinned EmDash cleanup algorithm and MediaUsageRepository reproduce a D1 counting bug with original migrations 046/061/062 and Source-locked `kysely-d1@0.4.0`. For one current, one stale, one abandoned and one orphan occurrence, D1 reports two orphan deletions after removing one orphan: the fence-trigger write is included in affected rows. Stale and abandoned rows remain in that tick. SQLite removes all three obsolete occurrences.

The native port preserves the pinned algorithms, mapper, SQL, providers and clocks. Only the new supplemental D1 expectation is grounded to the observed Source result; this correction earns zero Source or product repair credit. Full D1 cleanup correctness remains unfinished. The shared bug is tracked in [issue #114](https://github.com/sveltery/cms/issues/114).

## Local closure checkpoint

Root approved the finite Node environment-storage contract, the exact five old
Native role-expectation literals, the trusted whole usage-cleanup operator and
its existing-row-only operational initialization. Whole Source36/321 and the
original R2 mock1 pass; all188 immutable authorities and60 whole module
algorithms are guarded. Current supplemental Native22 pass with their original
deadlines, including Node environment4 and sequential usage2. Type checks report
0 errors / 0 warnings. The new D1 expectation follows the qualified shared pin
bug above and earns no repair credit. All earlier assertion failures, invalid
Native fixture, module stop, deadlines and transport failures remain in the
paired private receipts.

CI535 on fa5048d0 passed secured9 but failed normal service tests1495/1492pass/
3 old-role-assertion failures,0cancelled; only2 of13 normal stages finished.
The sealed literal proposal is now approved and applied. These historical gates
do not qualify this successor. Current normal13/secured9, fresh independent
and configured review, exact Root approval, author regular merge and post-main
verification remain pending. After an initial automatic approval review rejection,
the user explicitly authorized repository publication. The exact reviewed issue
payload was then published as [issue #114](https://github.com/sveltery/cms/issues/114),
and its related write-up has no remaining publication hold.


### Native Node import integration

The complete local bootstrap on `16b6cc31` finished frozen install and type
checks, then stopped in service tests: 1,495 registered, 1,486 passed, nine failed,
zero cancelled. Those nine existing Native runtime callbacks stopped while
loading exact Source StorageError parameter-property syntax through the shared
Node entry; they reached no value assertion failure. Ten later phases were
unreached. The raw result remains retained without clock or command changes.

Successor `8b1acb04` loads LocalStorage only inside the selected async factory,
so ordinary Node database startup keeps its existing import graph. All three
complete affected Native test files pass 24 callbacks, and all four environment
storage controls pass. The 188-authority/60-module Source guard remains exact.
This restores the Native entry graph without changing any Source algorithm,
fixture, assertion, dependency, provider or deadline; it earns no Source repair
credit.

Hosted [CI on 16b6cc31](https://github.com/sveltery/cms/actions/runs/37358343871)
completed all nine secured browser launches: seven Source suites
(14/30/25/3/35/4/3 callbacks), default Native 65 and Node Native 65. Every
launch used official Chromium headless shell v1243 with its sandbox enabled.
That is predecessor evidence only. Its normal job also failed the same nine
Native runtime imports: 1,495 registered, 1,486 passed, nine failed and zero
cancelled; only frozen install/type checks finished. Fresh normal and browser
gates, independent/configured review and exact Root technical approval remain
required for the successor.
