# Bounded draft trash service

This database-only slice was based on main `9d579f8a22e3215f3296448597361817a9babfbc` and integrates schema-admin merge `b45aac8` and EmDash 1.1.0 immutable pin `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`. It adds explicit trash reads and atomic draft restoration without changing existing service signatures or their error ordering. No remote, route, UI, publishing, permanent-delete, production factory, credentials or deployment is added. Native/web restore UI is a later slice.

## Service contract

Trusted callers compose `cmsService(database, principal)` as before. Client identity or ownership inputs are rejected. Existing active draft queries still exclude deleted rows.

| Method | Input and result | Permissions and errors |
| --- | --- | --- |
| `getTrashedDraft` | `{ type, id, locale? }`; full retained scalar draft data plus `deletedAt`. Without locale, lookup searches every locale; explicit locale must match. Active/missing rows are `NOT_FOUND`. | `content:read` and `content:read_drafts`, checked before validation/storage. |
| `listTrashedDrafts` | `{ type, locale?, limit? }`; `{ items }` of summaries with `deletedAt`, locale and revision tokens. Omission includes all locales. Default 50, cap 100, positive safe integer required; `deletedAt DESC, id DESC`. Title is at most 200 characters and body/data columns are excluded. | Same read permissions; strict validation precedes storage. No cursor/count/order override in this bounded API. |
| `restoreDraft` | `{ type, id, locale?, expected: { version, updatedAt } }`; returns this write's active `DraftEntry` from SQL `RETURNING`. Locale defaults to `en`, consistent with existing mutations; callers restoring other locales must pass the locale returned by trash reads. | `content:edit_own` or `content:edit_any`; delete permission does not grant restore. General authorization precedes parsing/storage. Persisted owner must match for edit-own; null owner denies edit-own. Missing row/collection is `NOT_FOUND`; authorized active row, stale token or losing race is `CONFLICT`. |

The internal repository has separate `findTrashedById`, `findByIdIncludingTrashed`, `listTrashed` and `restore` operations. They are storage seams; request callers must use the service. Including active rows in restore preflight preserves the pinned active-row conflict while allowing ownership denial first. The restore SQL repeats owner, ID, locale, draft status, deleted state, version and timestamp predicates. A schema-version guard and mutation execute in one atomic batch. A missing-row diagnostic after CAS loss yields `NOT_FOUND`; an existing row yields `CONFLICT`, including ownership changed after authorized preflight. Unexpected storage failures retain their errors and roll back the batch/guard rows.

Restore clears `deleted_at`, `live_revision_id` and `scheduled_at`, keeps status `draft`, increments version and advances timestamp to `max(Date.now(), expected updatedAt + 1 ms)`. It preserves scalar data, author, slug, locale, creation time and translation-group columns. This slice only supports stored draft rows and scalar schemas. It neither implements nor demonstrates restoring published content, revision pointers, revision history, scheduling, translations or revalidation of retained values against a changed field schema. The default draft fixtures have null live/schedule columns; clearing them earns no lifecycle parity credit.

## Immutable sources and accounting

All source links below use [the immutable EmDash pin](https://github.com/emdash-cms/emdash/tree/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e). Copyright 2026 Cloudflare Inc., MIT; the copied/adapted material retains [the notice](../notices/emdash-MIT.txt).

| Source path | Git blob |
| --- | --- |
| `packages/core/src/database/repositories/content.ts` | `29dab9decf9af0d9fb21b464dc185ed48ab958ea` |
| `packages/core/src/api/handlers/content.ts` | `34c2528c51a54119cd1730e876d699319c9f3702` |
| `packages/core/tests/integration/content/trash-locale-filter.test.ts` | `49f5ea1a533750f2c1a6b7bf78d12c468030c6e6` |
| `e2e/tests/content-actions.spec.ts` | `5bd09285048508d8c66d0e53761f32ea97f27a3c` |

| Source declaration ID suffix at the pin | Source expressions / local accounting |
| --- | --- |
| [trash-locale-filter.test.ts:57](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/packages/core/tests/integration/content/trash-locale-filter.test.ts#L57) | Two expressions: handler success and French slug array. Local selected test adapts the slug assertion only; service exceptions replace the handler envelope. |
| [:65](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/packages/core/tests/integration/content/trash-locale-filter.test.ts#L65) | Two expressions: success and all-locale slug set. Local selected test adapts the set assertion only. |
| [:75](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/packages/core/tests/integration/content/trash-locale-filter.test.ts#L75) | Two expressions: success and German locale. Local selected test adapts the locale assertion only. |
| [:83](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/packages/core/tests/integration/content/trash-locale-filter.test.ts#L83) | Both count expressions deferred; no count API or credit. |
| [content-actions.spec.ts:629](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/e2e/tests/content-actions.spec.ts#L629) | Browser workflow reference only. No browser assertions ported or credited. |

[Selected local adaptations](../tests/draft-trash-upstream.test.ts) execute three distinct value assertions on Node and local D1 (six evaluations). Local fixtures use draft creation/deletion with explicit owners and omit upstream `translationOf`; they do not reproduce the complete source fixture or handler envelope. Zero complete source declarations, published/revision leaves, or browser leaves receive parity credit. Duplicate supplemental assertions do not add source credit.

The [complete-source reproducer](../scripts/reproduce-draft-trash-upstream.mjs) executes the unchanged pinned repository and handler modules on real Node SQLite and the pinned upstream raw D1 dialect on Miniflare. It verifies source blobs, retains actual revision encoding/transaction code and seeds draft physical SQL rows. Unrelated imports throw if invoked; cache/request plugin context is disabled. Its printed fixture/import manifest records these substitutions. It does not execute the original registry setup or translation creation. The selected three locale cases preserve all six source expression values in the upstream-only harness; six additional probes per target cover bounds/order, active/missing restore, retained draft fields/revision, stale/double restore, same-runtime concurrent CAS and same-clock timestamp behavior. This totals nine tests per target, eighteen upstream tests, without establishing local full-leaf parity, deployed D1, upstream two-connection/restart/rollback evidence, or published/revision lifecycle parity.

## Proposed canonical compatibility entries — PR #19

These entries are registered in the shared [compatibility register](../parity/emdash/compatibility.md), proposed in [PR #19](https://github.com/sveltery/cms/pull/19). The parent cleared the schema-admin shared-record checkpoint at `36ca4775366e60f07a3bd5bd0061a76276b5cefb`; integration preserves its canonical records and the existing metadata/cursor/manifest records. An implemented or merged substitution does not establish specific acceptance; no specific deviation acceptance is recorded here.

| ID / immutable source | Upstream and local observable behavior | Rationale, evidence and decision state |
| --- | --- | --- |
| DT-01: bounded draft projection/lookup; pinned `ContentRepository.findTrashed` and `handleContentListTrashed` | Upstream supports all content statuses, full data, cursor and configurable ordering. Local supports draft-only, IDs with optional exact-locale lookup, body-free summaries, fixed deletion/ID descending ordering and no count/cursor. Both omission-all-locales/default50/cap100 behavior is measured. | Preserve the existing bounded scalar service and keep native/UI work separate. Selected locale adaptations and Node caps/order tests; deliberate API/fixture bounds, no full lifecycle/browser/count credit. Proposed in PR #19; specific acceptance not recorded. |
| DT-02: CAS/timestamp/atomic receipt; pinned `ContentRepository.restore` and transaction helper | Upstream allows an optional precondition, observes row version/timestamp, writes current clock and increments version; frozen-clock restores can retain updatedAt. Local requires both tokens, repeats owner predicates, guards schema version atomically, advances timestamp at least 1 ms and returns its own committed row. Upstream active restore conflicts; missing repository result maps to handler `NOT_FOUND`; local preserves those service codes. | Preserve existing mutation/CAS/atomic-adapter policy, persisted ownership and refreshed tokens. Paired frozen-clock probe, Node two-connection CAS/owner/RETURNING races and local D1 CAS/owner races, trigger rollback and restart tests. Different mandatory validation/monotonic timestamp/schema guard contract earns no parity credit. Proposed in PR #19; specific acceptance not recorded. |
| DT-03: validation/error/transport boundary; pinned handler versus local trusted service | Upstream restore handler exposes success/error envelopes, encoded optional `_rev` and ID/slug resolution. Local strict Valibot input accepts bounded type/ID/locale, mandatory version/timestamp, rejects extra identity keys and throws existing `CmsError` codes. Trash reads omit locale across locales; restore defaults `en` as existing local mutations. Read permissions and edit-own/any restoration happen in the service before input/storage, with persisted-owner denial before CAS mutation. | Preserve existing service APIs/error order used by schema-admin; no native transport is added. Hostile-input/no-storage and edit-own/edit-any/delete-only/null-owner tests. Supplemental local boundary evidence; source handler envelopes/slug behavior remain unimplemented and receive no credit. Proposed in PR #19; specific acceptance not recorded. |

## Executed evidence and handoff

On 2026-10-02, Node `24.19.0`, pnpm `12.6.0`, Kysely `0.29.2`, Miniflare `4.20260507.1`:

- Test-first Node service run: 13 tests, 2 boundary tests pass and 11 fail on missing repository operations (service declarations had just landed locally). Dedicated D1 and selected locale tests each ran red with two missing-API failures.
- Green: `node --test tests/draft-trash.test.ts tests/draft-trash-d1.test.ts tests/draft-trash-upstream.test.ts tests/draft-trash-workerd.test.ts`: 20 tests, including Node two-connection owner/CAS/receipt races, retained values, frozen-clock tokens, rollback and restart; actual local D1 concurrent restore/owner predicate/rollback/restart and Node/D1 schema-guard races; in-workerd execution without `nodejs_compat`.
- Upstream: `CMS_EMDASH_REPOSITORY=/tmp/emdash node scripts/reproduce-draft-trash-upstream.mjs`: 18/18 tests. Omit the environment variable to fetch immutable raw blobs instead.
- `pnpm check`: zero errors/warnings. Full bootstrap, secured default/Node hosted CI and independent/configured automatic review must be verified on the final implementation head in the PR handoff.

Next bounded handoff: parent coordinates merge after all final-head gates pass, then a separately owned native trash-query/restore-transport slice can bind `_rev` to collection/ID/locale and refresh active/trash queries. UI remains a later slice. Production writes/auth/storage composition, permanent deletion, publishing and deployment remain outside this handoff.
