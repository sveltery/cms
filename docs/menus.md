# Menus

The target is persisted, locale-aware navigation menus with editable hierarchical
items, translation cloning, content and taxonomy URL resolution, and native
administration. The authority is EmDash 1.1.0 at
[`913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`](https://github.com/emdash-cms/emdash/commit/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e).

The [source manifest](../parity/emdash/menu-source/manifest.json) preserves eleven
whole test files and their storage, runtime and admin authorities. Copied files
retain exact bytes and the [EmDash MIT attribution](../notices/emdash-MIT.txt).
The byte/assertion checker establishes provenance only; no source callback has
been executed at the first source-first checkpoint.

Storage follows source migrations 005, 036 and 078: names are unique within a
locale; menu and item translation groups survive cloning; references identify
translated content groups. Migration 036 removes menu-item cascade foreign keys,
so the repository explicitly deletes child rows. The native `_cms_*` namespace
is a framework storage substitution, not an EmDash database import promise.

Canonical startup currently has real providers 1–5. Menu descriptors remain
unregistered until a reviewed integration supplies their actual prerequisites;
no empty provider, skipped version, or test-only migration counts as product
startup. Public persistence, API routes, admin interaction, resolution, cache
integration, Node/D1 execution, final CI and review remain unfinished.

Source behavior, original native test evidence and framework substitutions are
recorded separately in the [compatibility register](../parity/emdash/compatibility.md).

At the first functional repository/handler staging checkpoint, two original
native callbacks completed their assertions with `false !== true`: the Source
SQL namespace did not yet resolve the real native descriptor tables. The
fixtures applied the named `_cms_menus`/`_cms_menu_items` descriptor explicitly
after existing canonical startup. Both failures are original native evidence,
not executed upstream callbacks. An earlier fixture incorrectly expected menu
registration from canonical providers1–5; it was corrected before execution
and earns zero causal credit. Initial missing-module setup also earns zero.

Local tests currently use a private copy of the exact thirty installed direct
third-party versions from the previously qualified public Redirects PR75. Own
package, lockfile and workspace policy bytes remain the exact d524 main base.
This establishes no own frozen-install, complete bootstrap or hosted-browser
pass. Two unchanged ordinary frozen installs failed on registry503 metadata
requests before any callbacks.

The first whole core run after normal local Kit sync executed five complete
files:92callbacks passed; the 93rd callback failed at dynamic native item-route
import before its expectations. These first-green Source callbacks establish
no behavioral red causality. Whole source SQL, fixtures and expectations remain
unchanged. A test-only Kysely facade translates the logical Source namespace
onto actual native tables and maps introspection/query-log names back for those
contracts; it establishes zero physical Source namespace/DDL equivalence.
PostgreSQL, full migration036, Source078, seed export, MCP and the24admin
callbacks remain unexecuted.

The native namespace repair preserved the two original list/create callbacks
and changed their result from false to true (2/2green). Four new original
raw-binding local D1 callbacks each reached the same false-versus-true assertion
against real storage before atomic write adaptation; no fixture/setup failure
is counted for those four. These are original Node/workerd cases, not extra
upstream callbacks or production startup.


The finite native D1 transport now commits create/clone/delete/replace/reorder
through the current adapter's real atomic batch, preserving its connection
scope. Twenty-four original storage callbacks pass: two SQLite handler cases,
four raw D1 handler cases, and six atomicity cases on each of SQLite, raw D1 and
the ordinary scoped D1 dialect. Real SQL triggers prove rollback for replacement,
cloning and reorder; missing-menu guards prevent orphan replacement; foreign
items and other locales remain scoped. The four original D1 handler assertions
changed from false to true; first-green and setup-operation failures from the
additional cases establish no extra Source causality. A mistaken scoped-dialect
constructor in the supplemental fixture was corrected with zero causal credit.

D1 clones take an immutable item/ULID mapping before the finite batch. Node reads
those source items inside its transaction. This timing substitution is proposed
for review, earns zero Source concurrency parity, and is not an acceptance
claim. No concurrency, signed, replay or protected-relation probes were run.
The complete five Source core files still run with unchanged expectations:
92 pass and one native item-route import remains unfinished.

Native request readiness now compares all eight owned table/index SQL
descriptors and attached objects in a readonly sqlite_master census. Named
original Node and D1 fixtures prove absent, partial, complete, unexpected-index
and wrong-index states; readiness neither applies DDL nor changes the canonical
versions 1–5. An initial missing-export setup and a mistaken first migration-row
assertion were corrected with zero causal credit. Startup registration and full
family integration remain unfinished. The descriptor retains the Source MIT
notice. All evidence remains local using the approved third-party dependency
copy; own normal frozen installation and hosted checks remain unqualified.


At the native-route checkpoint all 93 callbacks in the five whole core Source
files pass, including the real native item-route PUT/DELETE/prerender exports.
Fifty whole authorities retain exact Source bytes; the eleven immutable tests
still contain 169 declarations and 436 direct expectations. Full Source admin,
MCP, seed, Source036 and Source078 suites remain unexecuted.

The additive principal projection appends only menus:read and menus:manage to
the existing eleven capabilities. Existing RBAC already grants those at
Subscriber and Editor. Whole ordinary service evidence first showed three
strict original-array failures after the projection, then 1144/1144 passing
callbacks after authorized original arrays/counts included the two literals.
All previous identity, ordering and role assertions remain. These are original
bridge updates, not altered Source assertions. The private third-party copy
still earns no own frozen/full-normal/hosted credit.

D1 clone batches now check the complete source menu identity, item count and
all source item columns inside the same batch, after target-menu insertion.
Eight ordinary SQL-trigger cases first reached missing-rejection assertions,
then passed with rollback of the trigger changes and clone writes. Together
with earlier storage/readiness cases, 34 original callbacks pass. No concurrency
or protected probes were used. Source Node clones read items inside the callback
transaction; Source D1's helper falls back to separate statements with no
multi-statement atomicity. Native D1 uses atomic guarded snapshots and refuses
changed source input with MENU_CREATE_ERROR instead of copying a later view.
This intentional difference is proposed, with zero Source concurrency parity
and no recorded final acceptance.

The six actual native route families use current trusted locals, the existing
mutation gate and the exact readonly readiness census. They return Source menu
JSON envelopes/statuses and private, no-store headers. Unsafe native routes
consume the existing trusted-origin helper; Source's request-header bypass and
absent-Origin behavior are not reproduced. This framework difference remains
proposed with zero Source-origin credit. No auth/session/signature changes or
new auth/origin-denial tests are introduced. There is no request DDL, installer,
canonical registration or retained first-request database. Supplemental HTTP
fixtures preserve Source's historical GET lowest-locale choice and ambiguous
mutation behavior; the initial mistaken ambiguous-GET fixture earns zero credit.
The exact emdash:menu:name cache tag was restored after one original actual
value-red comparison against the frozen Source tag function.


The bounded cache adapter is now replaced by the full pinned object-cache core,
codec, memory backend and type contracts. The complete Source object-cache test
was committed first; all six whole Source core files now pass 128 callbacks.
The manifest preserves 51 authorities, twelve whole tests, 204 declarations and
495 direct expectations; the original eleven whole tests are unchanged. The
35 cache callbacks were first-green, with zero causal value-red credit; initial
missing-codec setup earns zero. Every Source fixture deadline remains intact.

Astro's generated object-cache module is replaced by an explicit trusted native
startup factory descriptor, disabled by default. Source epoch invalidation,
Date serialization, TTL, degraded backend reads, preview/edit/isolated/route-fill
bypass and deferred writes are retained. Native Symbol namespaces keep this
owned menu cache separate from other in-progress families. Current-request
keepAlive and the already-public deferred-task tracker replace the Source
virtual host callback; request context uses a Symbol-backed AsyncLocalStorage
across SSR chunks. These framework substitutions are proposed; no final specific
acceptance is recorded. Svelte checks pass using the previously approved private
340 dependency copy, still zero own frozen/full-normal/hosted credit. Complete
startup, cross-family runtime integration and native admin remain unfinished.


The native production menu client and Svelte list/editor now connect to the real
six REST route families. Five original DOM callbacks pass with real mounted
production components; their first-green result earns zero value-red causality.
The client preserves Source menu and item inputs, locale propagation, errors
and the Source custom-link URL pattern. List creation retains pending state
across dismissal/reopening; item rows preserve Source parent-first display,
descendant exclusions, sibling reordering and immediate deletion. Native pages
consume current trusted capabilities, readonly readiness and existing content
queries. No page/request installs menu storage. Svelte checks and a default
production build pass against the completed own ordinary frozen434 install.

The complete Source MenuList and MenuEditor JSX files are hosted through a
test-only React-to-production-Svelte mount transport. Their original API mocks,
fixtures, expectations and deadlines remain unchanged. Real pinned TanStack
providers are retained; Toasty and the test-render provider transport substitute
for Kumo/Lingui provider composition, earning zero Source-provider/full-Kumo
parity. The parameterized MenuList case expands the 24 static declarations to
25 actual browser callbacks. All remain unexecuted locally because the approved
official Chromium runtime is unavailable; only actual hosted CI can qualify
them. Native content selection uses existing remote collection/content queries;
full shared ContentPicker search/pagination and multilingual admin catalogs
remain incomplete dependencies, not passed by these two menu suites. Canonical
menu startup, MCP/seed/migration suites and whole-family integration stay in
progress. No final framework difference acceptance or public PR exists yet.


At the ordinary public-Main integration checkpoint, the feature branch merged
`e75654834e5d3a1ddc10449504ee34db1d43c905` with ordered parents recorded in
`ff31f707ed6279f6cfb45f58c2c88c3567d55249`. Its full 434-package/443-snapshot,
two-document lock, dependencies, workspace policy and bootstrap were retained.
Own normal `pnpm12.6.0 install --frozen-lockfile` then completed successfully;
the earlier private dependency-copy limitation remains historical. Complete
bootstrap and hosted browser qualification are still pending at this checkpoint.

Native menu dialogs now use the browser's actual modal dialog focus, cancellation
and backdrop behavior. Five original mounted UI callbacks pass and Svelte checks
report zero errors and warnings. The two supplemental dialog selectors now use
implicit native dialog semantics; no Source expectation changed. Source fixtures
continue to preserve all twelve whole tests, 204 declarations and 495 direct
expectations. The full object-cache test adds 35 unique callbacks relative to
public Main: the Redirects ledger and other public gates contain no copy of that
whole authority. Those callbacks remain first-green with zero causal value-red
credit.

The existing complete Source gate appends the six-file menu Source run and five
native UI callbacks after all public Source115, Redirects203 and native bulk14
checks. A separate secured hosted stage runs all 25 expanded menu admin Source
callbacks with the existing official sandbox setting, DEBUG browser diagnostics
and a 180-second command deadline. Existing production and 62-per-build browser
checks remain intact. Navigation displays Menus through the already trusted
menus:read capability. These additive gate/navigation edits have development
approval; no final framework acceptance, hosted pass, public PR or whole-family
completion is claimed. Real canonical integration, full shared ContentPicker,
multilingual admin catalogs and the pending Source migration/MCP/seed suites
remain explicit dependencies.


Fresh independent review found that the native read-only editor exposed an
enabled action for a missing translation. One additional original mounted UI
fixture was committed before the repair and reached an actual false-versus-true
disabled-state assertion; the complete native UI run changed from 5 pass/1 fail
to 6/6 pass. Creation now follows mutationsEnabled while an existing translation
remains navigable. This repairs the existing native capability presentation,
changes no role/session/API authorization and earns no additional Source parity
credit. All whole Source admin assertions remain unchanged. Final-head review
and hosted qualification continue on the successor head.


The content-picker integration is a bounded native dependency seam. Source's
MenuEditor passes no locale or collection restriction to the shared picker;
that picker lists collections, queries 50-entry pages with search and cursors,
and keeps the cached pages on reopening. The current native menu page uses
existing remotes, includes only routable collections and the selected menu
locale, and exposes its first returned page. It does not reproduce cross-locale
choices, all-collection browsing, search, accumulated pagination or shared query
cache behavior. These are explicit incomplete contracts, with zero full-picker
parity or final acceptance. Existing native remotes have a default locale and
no Source q/search input; completing this seam requires their real owned
integration, not a fake all-locale result or a changed Source assertion.

The ordinary full434 bootstrap completed installation, checks, service1147,
Source115+203+14+128/nativeUI5, Card23, default build, production255 and Node
packaging, then failed three unchanged isolated package installation subprocesses
at their 120-second deadlines. The Node product callbacks and two Cloudflare
bootstrap phases did not complete in that run; it earns zero complete bootstrap
credit. Separately, the reviewed UI successor passes six original UI cases,
Cloudflare build/official dry deployment, all23 CF Source callbacks and seven
real Worker cases. Public-Main integration and final hosted checks remain
pending; the ordinary Git fetch currently returns a transport503.


On draft PR78 head d45c40a, hosted run37149241663 completed the entire
thirteen-phase normal gate and secured browser gate. Whole core128 and complete
admin25 Source callbacks pass, with original fixtures and expectations intact;
all are first-green with zero Source value-red causality. The official1243
sandboxed browser also passed inherited Bulk14, Date30 and default/Node62 each.
This historical head qualifies hosted445 installation and normal execution; it
does not turn the retained failed local445 install into a pass or qualify a later
repair automatically. The configured Codex review request returned the actual
usage-limit receipt, with zero automated review success.

Root review then found that SQL normalization could remove double quotes and
collapse whitespace inside a locale literal. Six additional ordinary Node/raw
D1 fixture requirements were committed first and reached true-versus-false
readiness failures; the unchanged complete eight-case family passes after the
first menu-owned single-quoted-literal repair. Shared canonical normalization,
Source callbacks, descriptors, defaults and providers1–5 remain unchanged.
Additional literal-context verification and final successor gates are pending.


The follow-up ordinary SQLite fixture proved that a double-quoted
CURRENT_TIMESTAMP default stores the literal text rather than the timestamp
expression. Two more assertion-first Node/raw D1 requirements reached genuine
readiness true-versus-false failures before refactoring; the complete unchanged
ten-case family now passes. The owned normalizer preserves quoted tokens and
literal escapes/whitespace, removes quotes only from known owned schema
identifiers, and normalizes only SQLite's ASCII whitespace outside tokens.
The shared canonical normalizer and all owned descriptors/defaults remain
byte-unchanged. The eight new actual value-reds are original native evidence,
not additional Source callbacks. The repaired successor still requires complete
hosted normal/browser gates, same-task review and specific framework acceptance.


The shared content-picker successor is documented in [Content picker](content-picker.md).
It replaces the predecessor first-page/routable/menu-locale controls with the
actual reusable Svelte picker, all-collection full-data reads, cross-locale
choices, query-core caching, search and cursor50 accumulation. Native UI24 passes;
Node search still requires the real public canonical search metadata migration,
and complete Source/browser/normal/final-review acceptance remains pending.
The existing content-picker limitation paragraph records the predecessor
checkpoint rather than the current implementation's verified UI behavior.


The first picker hosted run installed445 and passed all inherited suites, but
its own browser callbacks stopped before assertions at missing provider setup.
The owned provider correction and complete31-authority record preserve zero
Source causal credit; see the paired picker record for actual pending combined
Main512/527 validation and the public canonical search prerequisite.


At combined picker author dcc0b5d0fc4979c1670f31e8835a973b49cf4476, secured run37161695883 passes all inherited Source browser families including complete Menu25, whole Picker3, default62 and Node62 with official1243 sandboxing and unchanged180s/30s deadlines. Own local/hosted frozen512 and checker0 pass. Complete normal remains blocked by missing public search_config in whole ownedcore22; canonical8 and final picker acceptance/merge remain pending. Picker Source first greens after provider setup repair earn0causal credit, and the earlier setup/local503 failures remain retained. Whole browser/validate SHA256 receipts: e92e5cac3a19e79057ea2241475f8f44c59df89229441f306c502fb8222f9318 /ed93e4f3ef1c19498602c325e352ff84a7dab9edeae5ef5fea7f07abfca3d613.


The picker ordinary Main311 integration preserves complete Comments gates alongside all prior Menus/Sections stages, unchanged dependency512/snapshot527/lock/bootstrap, and terminal whole picker additions. Prior dcc browser passes remain historical; current combined normal and public canonical8/final picker acceptance are pending.


The picker development integration of actual PUBLIC PR83head0b0624b28feca959df7bf6f3691f987b5487a759 preserves every canonical Source/frozen1–5 assertion and Main stage. The public nullable search_config seam can now be exercised by whole unchanged Source19+Native3 and actual HTTP2; those/current normal runs remain pending. Canonical83 has not yet merged to Main, and final picker merge still waits actual Main adoption and qualification. Exact TanStack MIT notices are retained and verified in the actual Node package (notice-only aa71f11, package log SHA256 2d8d424d5fd5d8ae85026418fae80057dd79ca1a858cecf443c497e7ad4fac91).


The shared picker public-schema development author4c1dd9499d96dc8c0388495a5c482b4ad238d120 passes the complete unchanged13-stage bootstrap:1357 services,278 production tests including real picker HTTP2/raw D1,15 Node hosting tests and7 Worker tests, all inherited stages, whole Source19+Native3 and NativeUI24. Actual HTTP search now passes through the public nullable search_config seam;18 earlier Source pre-expectation failures earn0causal credit. Whole normal log SHA256: b756d57a549b2d43e4c90f1bb2a587fbda25f9db79c3fde67ba68b3956a0d4ec. Historical03c hosted run37164760918 passes complete Menu25/Picker3/Comments4 and every other browser family/default62/Node62 but retains its old missing-column normal failure; browser/validate logs SHA256 25df7c3c1c0cfb0028c8c997afdf0e486398bb820abea51dbc9d0c285748ace6 /a20a4025df1cf6f7c1beb5846ef8167cf07ebabefe92e44ae75ad95c64edd8d7. Current hosted/final review/CP acceptance and actual PR83 Main adoption remain pending; an attempted native Git publication failed authentication at this checkpoint, with no alternate graph publication. Exact TanStack notices remain in the current generated Node package, and previous503/setup failures stay retained.


Actual public canonical Main d9668aa63c80bf2a9372d9fc7bfacb9a1eb9445c is ordinarily adopted at owned4dc6cca07ff4427c019635400f497f679122594a with the entire tree identical to executed4c1. Its current secured run37166879152 passes whole Menu25/Picker3 and all other Source families/default62/Node62, nine official1243 sandboxed launches, and every13 normal stage; browser/validate SHA256 bdb85753b621ecd630f31651ef3a2b15116e4a69447a2e358dd1eeb65c34ea5f /99375f29dc0468b6e73434557f399137398efeaccfb58e221ad6f72502cdb0f0. Root explicitly accepts these exact-tree receipts and grants bounded CP acceptance to the actual MenuEditor/shared modal + menu-page/client integration and reviewed query/English test-host/native transport substitutions. Section/reference consumer wiring and full picker/global palette/relation-write/multilingual/Pg scope remain unfinished. Source first greens retain0causal credit. Same-task final independent/configured review, exact-head approval, PR82 merge and post-Main checks remain pending; no duplicate execution is claimed for the Main/documentation successor.
