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

Trusted server configuration supplies a `Storage` instance through the existing
runtime presentation/request configuration. The final scoped D1 database spread
retains that instance, identity, session and waitUntil semantics. Node callers
can supply `LocalStorage`; Workers can supply `R2Storage` with their actual
trusted binding. The R2 class calls the supplied binding directly; an ambient
Web/Worker stream type contract changes no executable method body. No default
filesystem directory, bucket, credentials or Source `cloudflare:workers` env
factory is configured by this prerequisite. Environment provider construction
is a pending separately scoped hosting integration.

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
