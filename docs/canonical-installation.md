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
