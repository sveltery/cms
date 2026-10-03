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
