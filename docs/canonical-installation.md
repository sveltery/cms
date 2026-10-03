# Canonical options, taxonomy and metadata installation

The behavior reference is EmDash 1.1.0 at
`913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`. Normal `migrateCms` installation
now has real contiguous native providers 1–8. Existing providers 1–5 are frozen;
6 installs options and plugin storage, 7 installs taxonomy storage, and 8 adds
nullable collection search configuration and the field-to-collection delete
cascade. Requests use the existing startup runner rather than installing owned
DDL manually. The native version numbers consolidate the Source migration
chronology; they are not EmDash migration numbers.

## Storage and upgrade behavior

Provider 6 follows Source 001/004/022/023/038/053/077: options, plugin storage,
plugin state and plugin indexes retain their final column defaults, nullable
SQLite primary keys/timestamps, composite keys and partial indexes. The four
revision triggers retain Source `lower(hex(randomblob(16)))` stamping and full
row keys. Installed triggers and all declared future trigger names belong to the
canonical runner's separate SQLite trigger namespace. Both preflight and the
immediate atomic-batch guard compare actual definitions; names use SQLite's case
semantics. Unrelated operator triggers remain supported.

Provider 7 follows Source 001/006/015/036/045/047/048/049/051/056/068/082/085.
It installs term, pivot, definition and definition-group tables, final indexes,
English category/tag definition seeds and Source defaults. Term parent deletion
sets the parent reference to NULL. Pivot references remain advisory after
Source 036; Source 068's obsolete sort indexes are absent. Translation-group /
locale uniqueness is partial, excluding NULL groups. This installation uses
English defaults; configured multilingual defaults and the legacy EmDash 085
structure reconciliation are incomplete.

Provider 8 derives its descriptors from the existing native registry. It
preserves all 17 field columns and values, existing stricter native constraints,
and historical physical content columns. `search_config` is nullable TEXT with
no SQL default. Existing custom field indexes and all operator views/triggers
are captured and recreated from their exact original SQL in creation order.
An atomic snapshot guard refuses changed dependencies. An external foreign key
targeting `_cms_fields` is refused before the startup batch because SQLite
parent-table replacement could execute destructive delete actions. It requires
an operator-managed migration; no foreign-key disabling or non-atomic fallback
is supplied.

## Repository boundary

The complete options, conditional-storage, taxonomy, taxonomy-definition and
admin slugify Source bodies are retained, with only import/namespace adaptation
and attribution. The namespace adapter maps logical Source table identifiers
to native `_cms_` names, preserving bound values and single-quoted literals in
the finite Source raw templates used here. It is not a general SQL translator.
Source taxonomy imports use the existing strict native transaction helper,
rather than Source's unsupported-transaction callback fallback.

The D1 capability boundary recognizes the real raw/scoped D1 adapter.
It permits taxonomy SELECTs and structured single-query options mutations, and
refuses taxonomy writes before execution until an atomic adaptation exists.
The owned boundary checks nested operation nodes and raw mutation statements;
bound values remain untouched. This deliberate refusal is incomplete taxonomy
write support, not Source D1 parity. The exact boundary received development qualification; all fourteen refusal
requirements and both options/read controls pass on real raw/scoped D1. This
qualification is separate from specific framework acceptance and final review.

## Evidence and remaining work

[The inventory](canonical-installation-source.json) records 38 complete pinned
Source authorities and the complete MIT license. The source guard verifies all
bytes and five whole import-adapted runtime bodies. Only the whole taxonomy
pagination family is selected: two Node SQLite callbacks, six direct expect
expressions, unchanged five-term and 101-term fixtures. Its baseline callbacks
failed during fixture insertion, before assertions, so its later first greens
earn zero causal Source red credit. Whole options/revision families containing
protected concurrent cases are preserved and unexecuted. General Source
migration coverage, PostgreSQL and deployed hosting remain unqualified.

Original native requirements cover real Node SQLite, raw D1 and scoped D1 fresh
installation, actual frozen public-v5 upgrades, reopen/idempotence, option
values, revision stamping, exact defaults/indexes/FKs, operator-object
preservation, external-FK refusal and rollback. Whole existing startup/storage
regressions retain their historical v5 prefix/data assertions while explicitly
requiring the new v8 suffix. Updating their latest-version expectations earns
zero Source or causal credit. Ordinary trigger-ownership and D1 write-boundary
requirements are separate original tests, not ported Source assertions.

Normal and secured hosted gates, fresh final-head review, publication and merge
are pending. This change supplies storage prerequisites; settings/plugin
execution, taxonomy API/UI, content search configuration/FTS administration and
normal canonical registration of menus, sections/widgets and redirects remain
separate integration work. [Compatibility decisions](../parity/emdash/compatibility.md)
record native substitutions and distinguish development qualification from
specific acceptance.

## Complete historical-upgrade follow-on

The first normal run on `dc463b1` passed its frozen install and checker, then
recorded 1263 passes and 21 failures among 1284 service cases. The remaining ten
stages were unreached. Six existing cross-collection trigger checks revealed a
real snapshot failure: frozen provider5 preserved the exact trigger definitions
but recreated them in a different SQLite rowid order before metadata8 ran.
The qualified repair compares every captured name/type/owner/SQL record in
SQLite BINARY UTF8 order. It still restores dependencies in their originally
captured creation order. The other fifteen failures required explicit native
inventory successors: old operator SQL/effects, the five-version prefix and
absence of field-unique indexes on the original two content tables remain
asserted alongside the complete new canonical inventory.

The invariant helper now installs the actual complete, hash-guarded public5
fixture instead of calling the latest runner and labeling its result v5. An
explicit latest8 stage preserves the same ordinary single-binding checks,
adding 22 first-green callbacks with zero Source or causal credit. The real v5
upgrade then exposed eight completed before-write invariant assertion failures
for reserved objects and orphan field metadata introduced at its existing
prebatch seam. The qualified repair reuses the unchanged frozen lifecycle
content/collection/field snapshot guard before forward upgrades from installed
state5 or newer, after the leading static/future-trigger prerequisite. Guard
cleanup and the complete plan remain in one physical atomic batch.

The same complete eleven affected native families now pass all 178 callbacks,
with zero failures/cancellations/skips, on `6a6985b`. Both failed receipts remain
retained. Source authorities, complete runtime bodies, assertions/fixtures,
frozen providers1–5 and deadlines remain unchanged. These are native upgrade
repairs and fixture-contract corrections, with zero additional Source parity
credit; no new authentication, session, signature or protected Source family
is exercised.

The next combined successor ordinarily adopts actual public Sections/widgets
Main `2f1b74bdb9f368f5f5a75e4f0cfb065657924f56`, preserving all incoming
capabilities, Source commands, CI and the 512-package/527-snapshot lock closure.
Its complete normal and secured hosted gates, fresh final-head review,
specific acceptance, publication and merge remain pending. Earlier isolated
review and green receipts do not qualify that combined successor.

## Combined normal gate

The combined successor `03f29c6e96ab2c64094f9a20c936e1f3d29fb9aa`, with actual
public Sections/widgets Main `2f1b74bdb9f368f5f5a75e4f0cfb065657924f56` as an
ordinary merge parent, passed all thirteen unchanged normal stages. Frozen
installation verified the complete 512-package/527-snapshot lock closure;
the checker reported zero errors and warnings. All 1331 service, 261 production,
15 Node hosting and seven Cloudflare Worker callbacks passed with zero failures,
cancellations or skips. The complete retained Source/UI commands also passed,
including the whole two-callback taxonomy pagination family. This contributes
zero additional causal Source credit. The exact run receipt is
`0d5c49abcb03e7b17b89f42028c63c0a91f1e086ea296f2ed1031138cd130cb8`.

The earlier pending normal status records the development checkpoint before
this run. Secured hosted browser gates, independent review of this final
successor, specific acceptance, publication and merge remain pending. Both
failed receipts remain retained; a complete normal run does not establish the
remaining API/UI/plugin/FTS or deployed-hosting scope.
