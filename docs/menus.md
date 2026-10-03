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
