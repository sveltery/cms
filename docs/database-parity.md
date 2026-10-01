# Bounded EmDash database contract port

Reference: [EmDash 1.0.1 at 0e8977c221dd8e5111511eb226faa3d164c829ef](https://github.com/emdash-cms/emdash/tree/0e8977c221dd8e5111511eb226faa3d164c829ef). The pinned core package reports 1.0.1. Its MIT license is preserved verbatim in [notices/emdash-LICENSE](../notices/emdash-LICENSE). Copied and adapted files carry notices. No compatibility with the rest of EmDash is claimed.

The upstream review established the implementation baseline before writing this slice: Kysely 0.29.2, Node built-in SQLite with an explicit compatibility wrapper, persisted schema registry rows, real `ec_*` content tables and field columns, ULID identities, draft status, soft deletion, per-locale slug uniqueness, permission checks and revision preconditions. This follows the user's instruction to retain EmDash behavior unless a specific adaptation is justified.

## Test-first evidence and source IDs

Commit `cf9211d04033c1e00c86353dce629595bf9b4dd5` adds the ported tests before the implementation. [CI run 36899388506](https://github.com/sveltery/cms/actions/runs/36899388506) installed the frozen dependency lockfile with Node 24.21.0/pnpm 12.6.0, then failed checks on the missing implementation imports. This is evidence of a missing-module red state; the assertion bodies did not run in that commit. The selected local environment failed provisioning with `executor_registration_failed`, so no local red/green runs were possible.

Source IDs below are the exact upstream test names, under the pinned commit. Every assertion in each selected test is retained in meaning. Vitest assertions become Node strict assertions; Node SQLite row prototypes are normalized only in the driver tests, while the exact field/value shapes remain asserted. Registry `SchemaError` checks map to the slice's `CmsError`. Repo creation's author argument is server-only. Direct repository calls adapt to the slice API; fixtures omit Portable Text because those cases are explicitly unported.

| Upstream file | Source test IDs and exact assertions retained | Port |
| --- | --- | --- |
| `packages/core/tests/unit/db/node-sqlite-compat.test.ts` | implements the statement contract Kysely uses: inserted id 1; rows exactly [{ id: 1, title: "First entry" }] | `tests/database-node-compat.test.ts` |
| same | supports direct statement calls: open true; titles First/Second; get(2) Second | same |
| same | can be closed more than once: close does not throw; open false | same |
| same | normalizes supported positional values without shifting parameters: undefined/null, true/1, false/0, 7n/7, text, Uint8Array([1,2]) | same |
| same | rejects an unsupported %s before executing the statement (four cases): object, array, Date, boxed number throw /Cannot bind/; row count remains 0 | same |
| same | applies connection defaults without changing the journal mode: delete, synchronous 2, cache_size -16000, timeout 5000, foreign_keys 1 | same |
| same | switches to WAL with NORMAL synchronization when requested: wal, synchronous 1, cache_size -16000 | same |
| same | keeps NORMAL synchronization when reopening an existing WAL database without the option: wal and synchronous 1 | same |
| `packages/core/tests/unit/schema/registry.test.ts` | should create a collection: posts, Blog Posts, Post, supports drafts/revisions, source manual, id defined | `tests/database-upstream.test.ts` |
| same | F14: defaults supports to ['drafts', 'revisions'] when undefined: sorted supports match | same |
| same | F14: preserves explicit empty supports array (opt-out): supports [] | same |
| same | should create the content table when creating a collection: insert test-id/test-slug/draft into ec_articles succeeds | same |
| same | rejects an unregistered content table with a structured conflict: COLLECTION_TABLE_ORPHANED | same |
| same | should list collections: length 2; sorted slugs pages/posts | same |
| same | should get a collection by slug: non-null; products; description Store products | same |
| same | should return null for non-existent collection: null | same |
| same | should throw when creating duplicate collection: domain/schema error | same |
| same | should add column to content table when creating field: direct title insert; stored title Test Title | same |
| same | should get a field by slug: non-null; validation exactly minLength 1/maxLength 100 | same |
| same | should reject reserved field slugs: id/string and created_at/datetime throw domain/schema error | same |
| `packages/core/tests/database/repositories/content.test.ts` | should create content with minimal data: id defined; type post; data {title:"Test Post"}; status draft; timestamps defined | `tests/database-upstream.test.ts` |
| same | should throw error for duplicate type+slug: rejects second duplicate-slug | same |
| same | should allow same slug for different types: post/page with same-slug both succeed | same |
| same | should allow null slug: returned slug null | same |
| same | should generate unique ID: IDs differ | same |
| same | should find content by ID: non-null; id/data exactly match created entry | same |
| same | should return null for non-existent ID: null | same |
| same | should return null when type doesn't match: lookup in page returns null | same |

There are 31 ported cases: 11 driver cases (including four parameterized unsupported-value cases), 12 registry cases and 8 draft repository cases. Passing status requires the final CI run; a table mapping is not evidence of a passing test.

## Unported and blocked contracts

All other cases in the source files above remain **unported**, including destructive schema changes, collection update/order/sidebar/UI properties, other field types, field reordering, FTS, media usage capture, published/scheduled content, revisions, restoration and multilingual translation groups. Initial unpublished drafts use physical field columns, as in the upstream repository. The stored supports array retains upstream defaults/configuration; this slice does not yet implement a revision history or publish workflow.

The draft-read-after-update and partial-merge assertions in `packages/core/tests/integration/mcp/drafts.test.ts` inform supplemental tests, but are **not ported MCP tests**: their harness includes publishing/live-vs-draft revision semantics absent from this slice. Core behavior inventory and future ports must keep those tests visible rather than remove assertions to claim parity.

Cloudflare's `packages/cloudflare/tests/db/d1-dialect.test.ts`, D1 session/request-scope tests, `packages/core/tests/workerd/*d1.test.ts` and live D1 migration tests remain **unported/blocked**. There is no D1 adapter or Workers hosting configuration in this PR. The provider-neutral Kysely/batch seam keeps that target open; Node SQLite success does not establish D1 transaction behavior.

## Supplemental tests and deliberate bounds

`tests/database.test.ts` contains original tests for restart persistence, repeated system migration, failed additive-field rollback, DDL/DML batch rollback, identifier/value injection resistance, client ownership rejection, SQL required/unique/foreign-key constraints, UTF-16 length validation, index identity collision prevention, fail-closed authorization before storage, persisted ownership, two-connection optimistic concurrency, schema version conflicts, field bounds and body-free paginated summaries.

Specific scope differences:

- SvelteKit remote functions will replace Astro REST/React transport in the integration slice; this PR registers no routes.
- System tables use `_cms_*` rather than `_emdash_*` to prevent falsely treating an upstream database as an upgradeable CMS database. The `ec_*` physical collection model is retained. This is not an EmDash data import.
- Only string/text fields and unpublished drafts are enabled. SQLite status constraints prevent accidental publishing through this slice. Maximum 100 collections, 32 fields, 100,000 characters per text value and 200,000 characters per submitted data payload keep operations bounded. String fields default to 200 characters; configured limits can extend them.
- List transport returns metadata plus a title of at most 200 characters, never full bodies. Default page 50, hard maximum 100, with stable created_at/id keyset ordering. This deliberately narrower projection avoids returning full documents during dashboard navigation.
- Update/delete require a version and updatedAt pair, following the upstream revision precondition shape. The version predicate is enforced by SQL; a stale update or delete reports CONFLICT. Identity comes from the server principal, and ownership comes from author_id in storage.
- Length validation retains upstream JavaScript UTF-16 semantics in the service. SQLite's length() is not used for field validation because its code-point/NUL behavior differs. NUL is rejected only in schema default values, which SQLite cannot represent as DDL literals; bound content values preserve it.
- Unlike upstream's callback transaction fallback, every schema/guarded write requires an adapter-proven atomic batch. There is no non-atomic fallback. This prevents silently claiming multi-statement D1 safety. The SQLite batch owns Kysely's connection mutex and executes synchronously between BEGIN IMMEDIATE and COMMIT.
- Collection/field deletion, rename and type conversion have no API. Adding a required field without a suitable default to existing data fails and rolls back; an explicit backfill/migration plan is needed before supporting that operation.
