# Approved EmDash 1.1.0 baseline update

The parent approved EmDash **1.1.0**, exact commit **`913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`**, before integration. The project is early, all 86 initial candidate registrations remain unchanged, and this release fixes schema-publication, pagination and security-relevant behavior. This is an explicit update from **1.0.1**, commit **`0e8977c221dd8e5111511eb226faa3d164c829ef`**, rather than an automatic upgrade to a moving release.

The official `emdash@1.1.0` tag and core package version match the approved SHA. [GitHub published the release](https://github.com/emdash-cms/emdash/releases/tag/emdash%401.1.0) on **2026-10-01 at 16:37:38 UTC**. The root MIT license is byte-identical across both commits; the upstream notice remains intact.

## Behavior motivating the update

- [Publishing after field deletion](https://github.com/emdash-cms/emdash/pull/3617) uses the current writable schema while retaining historical revision data. The added `integration/content/deleted-field-stranded-entry.test.ts:92` checks that an existing draft publishes without another save and keeps the original revision payload.
- [Nullable sort pagination](https://github.com/emdash-cms/emdash/pull/3662) returns every entry once, keeps null and empty values distinct, accepts previous cursors, and retains filters on each page. Parenthesizing the indexed-null cursor condition prevents the `OR` branch from escaping status/trash predicates; the regression checks published-only paging excludes drafts and trashed rows.
- [Cloudflare affected-row handling](https://github.com/emdash-cms/emdash/pull/3633) uses SQLite `changes()` instead of index-inclusive `rowsWritten`, including collection-deletion fencing and preview writes.
- [Setup origin handling](https://github.com/emdash-cms/emdash/pull/3711) permits a production Cloudflare hostname to supply the HTTPS origin while retaining configured-origin requirements for production Node and rejecting public-host inference in development.
- [Turnstile runtime secrets](https://github.com/emdash-cms/emdash/pull/3622) correct verification being omitted for runtime-only keys and secrets being embedded through build-time environment substitution. Its production-bundle regression remains a follow-up before comments are implemented; comments are outside the initial scope.

Schema registry, core RBAC rules and revision-handler source are unchanged. Save hooks gain locale metadata; byline translation, request-scoped caching, redirects, calendar, Microsoft OAuth and rich blocks have additional changes. They remain inventory expansion/future feature work where relevant. Repinning does not authorize those features or changes to product security configuration in the initial slice.

## Exact inventory and scope impact

| Inventory | Source files | Declarations | Assertion expressions | Product tests run |
| --- | --- | --- | --- | --- |
| Previous 1.0.1 selection | 113 | 1,296 | 3,283 | 0 |
| 1.1.0 with that same selection | 113 | 1,299 | 3,292 | 0 |
| Approved 1.1.0 selection | 117 | 1,318 | 3,346 | 0 |

The four added source files are:

1. `packages/core/tests/integration/database/content-nullable-order-pagination.test.ts`
2. `packages/core/tests/database/repositories/content-order-plan.test.ts`
3. `packages/cloudflare/tests/db/do-preview-affected-rows.test.ts`
4. `packages/core/tests/integration/astro/setup-site-url-lock.test.ts`

Across the predecessor selection, 109 source files are unchanged and four change. The mapping retains all 1,296 declarations, identifies five changed registration bodies and three changed assertion lists, and removes none. The 22 additions to the catalog comprise **12 new upstream declarations** and **10 pre-existing declarations newly selected**. Counts are before dataset/dialect/runtime expansion.

The initial five slices still contain **86 registrations** with identical registration hashes and declaration lines. Their source IDs now use the approved SHA and retain `previousSourceId`. Added regressions are inventoried for the relevant schema, pagination and adapter work; their inclusion does not enlarge the initial product implementation scope. Calendar, OAuth, comments, rich editors and additional adapters remain deferred as already documented.

## Preserve and verify source identity

[baseline-map.json](baseline-map.json) links each previous `commit:path:line` ID to its current ID, keeps both pinned URLs and registration/assertion hashes, and flags source-file, registration and assertion changes separately. Changed predecessor assertion lists are retained verbatim; unchanged lists can be found in the current inventory and verified against their shared expression hash. A source-file change flags fixture/hook context that needs rereading even when a test body is unchanged.

[selection-1.0.1.json](selection-1.0.1.json) preserves the original selector. [baseline-map.mjs](baseline-map.mjs) reconstructs both catalogs from committed upstream blobs and rejects ambiguous matches, removals or a mismatching current catalog. The mapping's previous catalog hash matches the original PR #4 artifact at CMS commit `71fb210e1867dbdf464defdd6a5490fdd84a26ae`; no previous ID is discarded. Run the catalog and mapping checks in the [README](README.md) before reviewing an update.

Every entry remains `inventory-only`, with no executable upstream port or product coverage credited. Independent review and CI evidence are recorded separately in [review.md](review.md).
