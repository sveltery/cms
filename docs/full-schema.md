# Persisted schema types, metadata, and upgrade foundation

This feature extends the former string/text-only storage to all 17 field type
names in EmDash 1.1.0 commit `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`.
It does not complete the product's blocks, relation, search, or publishing UI.
The [source manifest](full-schema-sources.json) and [assertion ledger](full-schema-ports.json)
separate copied code, exact source assertions, and supplemental integration cases.

`SchemaRegistry` persists collection presentation and workflow metadata, field
validation/default/widget/options, indexed/searchable/translatable flags, all
TEXT/REAL/INTEGER/JSON affinities, text-alias type changes, reordering, and schema
deletion. `required`/`unique` changes and making a field non-translatable require
a separate explicit content migration. Unique remains registry metadata as in
the pin. Indexed scalar fields create both generated content ordering indexes.
Storage-compatible metadata edits retain existing rows and SQL defaults.

The exact pinned Zod generator and full content validation helper now run before
actual draft create/update. Arrays and object/media values serialize as JSON;
booleans serialize to 0/1 and reads retain the pinned integer shape. Optional
NULL values, numeric/enum/URL/datetime/repeater validation, required checks,
reference target existence and ordered issues with paths/bounds/formats follow
the pinned helper. Partial updates validate supplied fields. Legacy data remains
readable without being rewritten. Native registered transport issue projection
and richer field controls are a separate dependent feature.

Version 3 atomically copies collection/field metadata into expanded tables;
it preserves IDs, versions, timestamps, defaults and validation JSON. Content
tables and physical columns are retained verbatim. Version 4 registers the
auth developer's empty additive identity tables. No identity, setup credential,
session, or production database is seeded. The central provider interface
reserves version 5 for the lifecycle developer. Migration markers become a
positive contiguous sequence. Known incomplete/future layouts and temporary
copies reject without repair. Each upgrade, markers and trash indexes run in
one adapter batch; a concurrent caller succeeds only after proving the complete
committed schema. Supplemental Node/local D1 cases cover rollback, concurrency,
malformed layouts, retained data and restart.

The proposed [forward metadata fidelity provider](metadata-fidelity-upgrade.md)
adds cascading field collection deletion and nullable collection search
configuration without rewriting version 3. Search and operator upgrade limits
remain explicit in its separate evidence record; final review and landing are
pending.

The full generator file preserves 54 declarations and 115 assertion expressions,
expanded to 74 Node cases. Registry collection/field suites preserve 53
declarations and 111 expressions, expanded to 54 Node cases. All copied datasets
and assertion expectations remain unchanged. Fourteen remaining registry
declarations for FTS and development type generation are still unported. Block
type version management and reference edge integration suites remain unported;
recognizing the `blocks`/`reference` field names does not establish those features.
Postgres and deployed hosting remain unverified. The existing 118-file selected
catalog remains intact; this feature adds no claim that it represents the full
upstream product catalog.

Collection creation/update derives `hasSeo` from supplied `supports` unless
explicitly overridden, matching the pin. Reordering updates timestamps for listed
and cleared collections without a version bump. Deleting the title/date field
clears its pointer and updates that collection's timestamp; deleting an unrelated
field leaves metadata timestamps intact. The existing local monotonic metadata
timestamp adaptation keeps stale CAS tokens invalid for these operations.

Test-first evidence distinguishes the existing public capability failures from
the new generator API scaffold: public registry 0/2 before implementation;
generator scaffold 10/74 passed, 64 assertion failures; registry 52/54 before
unsupported metadata fidelity repairs; actual content service 0/2 before JSON
serialization and detailed validation. Focused final runs pass 74 generator,
54 registry, 3 actual content, and 4 upgrade cases. Final complete bootstrap,
hosted sandboxed browser CI and independent review are recorded on the PR head.

Two previous supplemental assumptions were corrected after executing immutable
source. Zod 4.5.4 string bounds count Unicode codepoints: one emoji fails minimum
2, while emoji plus ASCII passes exact length 2. Omitted optional `constructor`
fields observe the inherited function and fail `invalid_type`. The latter is a
preserved shared upstream bug tracked in [issue #35](https://github.com/sveltery/cms/issues/35).
Existing scalar fixture duplicates explicitly send `constructor: null` to
continue their storage contracts; a new actual-service regression preserves the
omission failure. This does not approve a local bug fix. Reproduce six source
fixture probes with:

```sh
node scripts/reproduce-full-schema-source.mjs /path/to/pinned/emdash
```

Current intentional differences remain: strict Valibot/native input objects,
bounded collection/field identifiers and payloads, legacy creation label/default
bounds, metadata collection CAS and atomic adapter batches. These have distinct
framework/storage records and do not earn upstream parity credit. The pure
copied code generator still emits EmDash imports/augmentation for fidelity tests;
a usable native generated public query API is not implemented by this feature.

The shared input boundary intentionally requires recursive JSON values. It
rejects nested undefined/function/symbol/BigInt, nonfinite numbers, Date/Map/Set,
sparse arrays, cycles, custom objects, accessors and extra non-JSON properties
before either create or partial update writes. Plain/null-prototype objects,
dense arrays, finite numbers and repeated noncyclic references are accepted.
This is the stricter local adaptation FS-07, not behavior attributed to the
pinned `json` validator. The copied generator and serializer retain their exact
source behavior. The dependent transport has separate enhanced request evidence.

Review regressions were committed before fixes in `0cb9fe7`: 2 cases passed and
12 assertion failures reproduced SEO, timestamp and nested JSON defects across
Node/local D1. Implementation `21bab4c` passes all 14, including stale-CAS denial,
untouched unreferenced collection metadata and no-write create/update checks.
These supplements grant zero new upstream source declaration/assertion credit.
PR #39 initially passed CI run 37061467935; rebased review fixes require a fresh
final-head bootstrap, secured browser CI and independent delta review.
