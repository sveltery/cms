# Forward metadata storage fidelity

Provider 8 repairs two physical metadata differences against EmDash 1.1.0
`913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`: fields reference their collection with
`ON DELETE CASCADE`, and collections have nullable `TEXT search_config`. Null
means unconfigured; the upgrade neither enables search nor creates FTS tables.
Search algorithms, configuration projection, and native controls belong to the
search feature. Options 6 and taxonomies 7 are real preceding providers.

Historical foundation/schema migrations remain immutable. The provider rebuilds
only `_cms_fields`, copies all 17 metadata columns and every row without changing
IDs, defaults or JSON, restores field indexes, and adds `search_config` to
`_cms_collections`. Content tables, physical content defaults, auth, options,
taxonomy rows, and migration history remain intact. Startup resolves final
installed static descriptors before lifecycle metadata reads; that generic
repair is supplied by the migration PR.

The native atomic plan snapshots the old view/trigger catalogue, operator metadata
indexes, and candidate foreign-child DDL. Its read-only precondition executes
after the existing static prerequisite guard and before the first startup write.
Views and triggers are removed during the metadata replacement and restored from
their original SQL after both final tables exist. They are never rewritten.
Actual operator child tables referencing a rebuilt parent reject with
`MIGRATION_REQUIRED`, preserving the entire database rather than disabling
foreign-key enforcement or cascading child rows during the rebuild. Prefixes
1/2 guard both `_cms_fields` and `_cms_collections`, since immutable provider 3
rebuilds both; prefixes 3–7 guard fields only. External collection children
remain valid when provider 8 only adds the search column. Independent
catalogue changes abort the whole startup batch. Ordinary operator/auth row
writes are outside the catalogue snapshot.

Operator catalogue preservation is qualified for prefixes 1/2 and 7. For the
earlier layouts, an optional provider preparation phase validates every old
catalogue before any metadata objects are temporarily removed; the removals run
before immutable provider 3. Provider 5 supplies its unchanged content snapshot
guard to the same preparation phase, and tolerates already removed triggers
with `DROP TRIGGER IF EXISTS`. Its snapshot, token, cleanup and rebuild SQL remain
unchanged. These narrowly scoped native composition changes belong to this
forward-upgrade feature; the generic static-descriptor and managed-FTS startup
repairs belong to PR42. This is not a verified shared EmDash bug.
Normal fresh setup and actual prefixes 1 through 7 retain stored rows/defaults.
Existing content-column uniqueness/default divergence, unsupported raw-type
fallback issue #44, and earlier atomicity decisions remain separate.

The [evidence ledger](metadata-fidelity-upgrade-ports.json) distinguishes source
inspection, exact source modules, original physical assertions, and product
runs. Complete unchanged source migrations 003/012 and their complete helper
closure execute on real Node SQLite and local workerd/D1. Four immutable Git blob
hashes are verified before loading; only TypeScript erasure and host import
resolution change. These two paired physical probes are original tests, with
zero copied source-test-declaration credit. The taxonomy owner retains credit
for its unchanged term-count callback; this provider supplies its missing FK.

Tests first committed six actual native assertion failures on both databases.
The operator baseline then recorded 18 real assertion failures and two unrelated
object passes; preserving dependent objects strengthened those original probes
before implementation. Four historical view/trigger assertions then failed
before the preparation-phase repair; full Node/D1 upgrades retain chained
views, attached metadata/content triggers and operator indexes on both metadata
tables. The 50-case foreign-child matrix initially passed 26 and failed 24 real
assertions for collection children; after repair all 50 pass, including
independently committed raced child rows with CASCADE, SET NULL and RESTRICT.
Forty prefix/preservation/fault/concurrency cases passed
on their first run and receive no invented red credit. The startup restart
integration separately failed two genuine assertions before the migration
developer's generic descriptor repair. A fixture-only null-prototype mismatch
was normalized and is not a product defect or source assertion change. The
latest integrated PR42 checkpoint passes 130 focused cases with checker 0/0.
Four additional first-run native guard probes verify that independently
committed field metadata edits abort prefixes1/2 before catalogue removals,
retaining both the writer's change and the complete original catalogue. They
earn no assertion-red credit.

This PR currently consumes named, unapproved migration/options/taxonomy/auth/
lifecycle/editor development dependencies. Final replay will contain only its
own changes on actual approved main. Required normal frozen installation,
complete CI, secured browsers, independent/configured final-head review, PM
approval, author-owned guarded merge, and post-merge verification remain pending.
No deployed D1, external resources, source-wide migration universe, or search
feature completion is claimed.
