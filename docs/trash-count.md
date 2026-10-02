# Read-only draft trash count

Based on verified CMS main `ad2efe16d42cafff8c2d0d5b6d38eeca4f9b0830`, after [passing post-merge CI](https://github.com/sveltery/cms/actions/runs/37040933046). Source authority is EmDash 1.1.0 immutable `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`. Implementation authorization follows the continuous parity-first request; specific acceptance of remaining adaptations is not recorded. Existing DT/DTT/CTV/NTR/TP, FE/FL/SF, C-07/SA-03 and issue #20 records remain intact. MIT attribution is retained in [the upstream notice](../notices/emdash-MIT.txt).

## Sources and count contract

| Immutable source | Blob | Inspected behavior |
| --- | --- | --- |
| [repositories/content.ts:1770](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/packages/core/src/database/repositories/content.ts#L1770) | `29dab9decf9af0d9fb21b464dc185ed48ab958ea` | SQL count(id), deleted_at IS NOT NULL, optional truthy locale predicate, Number(count or 0); independent of pagination, no status predicate. |
| [handlers/content.ts:2087](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/packages/core/src/api/handlers/content.ts#L2087) | `34c2528c51a54119cd1730e876d699319c9f3702` | Repository count wrapped as API success/data/count or CONTENT_COUNT_ERROR. |
| [trash-locale-filter.test.ts:83](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/packages/core/tests/integration/content/trash-locale-filter.test.ts#L83) | `49f5ea1a533750f2c1a6b7bf78d12c468030c6e6` | Scoped English 1 and omitted-locale 3; shared setup creates French translationOf English and uses registry/dialect migrations. |
| [router.tsx:729](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/packages/admin/src/router.tsx#L729) | `4b4793ea63352f8a80ccb695a809586cef06db93` | Supplies trashedData.items.length or 0 to the loaded-count badge; repository count is not wired there. |

`DraftRepository.countTrashed(type, { locale? })` and authorized `cmsService.countTrashedDrafts({ type, locale? })` return a number. Registered native `countTrashedContent({ collection, locale? })` returns the same number through Kit's query envelope. Omitted locale counts all locales; an explicit supported locale filters exactly. Strict existing identifiers/locales reject unsupported fields, including cursor/limit, rather than assigning pagination semantics. Local status='draft' preserves the existing product boundary and excludes synthetic deleted published rows; this is narrower than upstream, not new lifecycle support. Active rows are excluded. No rows or retained field values are returned. Missing collections retain NOT_FOUND.

Read authorization requires both content:read and content:read_drafts before service validation or storage. No new permission, adapter, migration, CAS, token, production composition or mutation configuration is introduced. Existing mutation receipts, persisted ownership, revision checks and default-disabled HTTP write gate remain unchanged.

## Native refresh and UI boundary

Trash and restore refresh canonical `{ collection }` and `{ collection, locale: changedLocale }` count keys. Matching original requested native count instances are refreshed through the existing asynchronous `requested` iterator, with five instances per family before scope filtering. Unrelated collections and other scoped locales are not refreshed. A denied count read remains its own native query error alongside a successful write-only mutation receipt; count failures do not disclose content or become mutation failures.

Counts are independent SQL reads and can exceed the default 50/max 100 page size. Count and list refreshes can observe different instants. No atomic snapshot, stable total, family-wide refresh beyond the existing bound, or exhaustion proof is claimed.

The application UI keeps its current loaded-row wording and append/Load More semantics. No total badge/display is added. A future small total display would be a separately proposed presentation adaptation: label loaded rows and current independently fetched count explicitly, handle unavailable count independently, and avoid implying snapshot consistency. That proposal is not implemented or accepted by this slice.

## Assertion accounting and verification

[The dedicated ledger](trash-count-ports.json) records two adapted value expectations from line 83 and zero complete source declarations. Local setup creates independent scalar drafts with explicit owners and locales; translationOf, original schema-registry/migration setup, upstream API success conjunctions and dialect family are not reproduced. The two numbers are preserved as adapted expectations, not full source parity. The existing inventory already includes line 83 and stays unchanged.

[The upstream reproducer](../scripts/reproduce-trash-count-upstream.mjs) adds an optional --count mode to the existing complete pinned repository/handler runner without changing its default nine cases per runtime. `CMS_EMDASH_REPOSITORY=/tmp/emdash-source-audit node scripts/reproduce-trash-count-upstream.mjs` passed 14 tests on Node SQLite and 14 on local D1: nine existing cases plus one adapted count expectation case and four count supplements per target. The direct-seeded draft physical table, throwing unused import seams and disabled cache/wait-until virtual modules remain disclosed by the printed manifest. A raw mixed-status probe demonstrates the upstream absence of a status predicate only. It does not exercise publication, full migrations, authorization, HTTP/browser, deployed adapters or original translation creation.

Local storage tests cover empty/scoped/all-locales, active exclusion, counts greater than pagination caps, mixed-status draft filtering, restore/trash freshness, persistence reopen and no-storage denials. Registered HTTP tests cover Node/local D1 native query/error envelopes and original-key/locale/family-bound refresh. Test-only browser composition retains real native count proxies at root and /cms, including unavailable states and restore/trash updates; it does not change application UI. Commands, actual results and final-head integration gates are recorded in the ledger and PR handoff. Pending checks are not passes.

Production composition remains unconfigured; writes remain default-disabled. Permanent deletion, published/revision/translation lifecycle, richer schema, localization and deployed runtime support remain incomplete. No live data, production settings/access, deployment or release is changed.
