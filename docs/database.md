# Self-hosted database foundation

This slice supplies a server-only database/domain API. Authentication, dashboard schema editing, remote-function transport and hosting adapters are separate integration work. Nothing opens a database, runs migrations or creates a principal at module import, and no public write route is enabled.

## Runtime contract

Use Node 24 and pnpm 12.6.0. The local adapter is `openSqlite(path)` from `src/lib/server/database/sqlite.ts`; close it at process shutdown. An operator explicitly runs `migrateCms(database)` before serving requests. Preserve the SQLite file and WAL files on persistent local storage. Make backups before later migration work; system migrations are forward-only. Version two atomically registers empty auth tables, upgrades the original version-one tracking table and preserves content. Missing/partial/unknown migration state fails with MIGRATION_REQUIRED without repair; see [the migration and session contract](session-composition.md). The bounded checks are not a full content-schema checksum or corruption-recovery mechanism.

Compose `cmsService(database, principal)` inside trusted server request composition. A principal is `{ id, permissions }` resolved from authenticated server state. Never build it from form fields, a client-provided role, an owner ID or unverified session claims. Anonymous/missing principals fail with UNAUTHENTICATED; insufficient permissions fail with FORBIDDEN. The service snapshots its principal. It does not invent a login, session or bypass identity.

| Operation | Input | Required permission |
| --- | --- | --- |
| listCollections | none; returns at most 100 definitions | schema:read |
| getCollection | collection slug; returns definition plus at most 32 fields | schema:read |
| createCollection | {slug, label, labelSingular?, description?, supports?} | schema:manage |
| addField | {collection, expectedSchemaVersion, input:{slug,label,type,required?,unique?,defaultValue?,validation?}} | schema:manage |
| createDraft | {type, data, slug?, locale?} | content:create |
| getDraft | {type,id,locale?} | content:read and content:read_drafts |
| listDrafts | {type,limit?,cursor?,locale?} | content:read and content:read_drafts |
| updateDraft | {type,id,expected:{version,updatedAt},data,slug?,locale?} | content:edit_any, or content:edit_own with matching persisted author |
| deleteDraft | {type,id,expected:{version,updatedAt},locale?} | content:delete_any, or content:delete_own with matching persisted author |

`type` is the collection slug, matching the upstream repository's content type convention. Locale defaults to en. Mutation inputs are strict objects: client author/role/principal/status fields are rejected. Updates merge supplied field columns with existing values; omitted fields remain intact. Setting an optional field to null clears it. Delete is soft deletion; it advances version and removes the record from normal reads/lists. There is no permanent deletion operation.

Identifiers match `/^[a-z][a-z0-9_]*$/` and are capped at 63 characters. Reserved collections/fields follow the pinned EmDash names plus locale/translation_group collision protection. Dynamic identifiers use Kysely references; values use parameters. The safe schema builder handles escaped literal defaults because SQLite DDL cannot bind DEFAULT values. Concurrent registered-slug creation maps SQLite's specific uniqueness error to COLLECTION_EXISTS; unrelated storage failures remain unexpected server errors. Schema defaults containing NUL are rejected before DDL; bound entry values may contain NUL. Fields are string or text, physically stored as TEXT. Metadata stores required/unique/default/length validation and order. SQLite NOT NULL constraints and unique indexes enforce required/unique semantics. Length validation runs in the service with JavaScript UTF-16 units, matching upstream string validation. It is not duplicated as SQLite length() CHECK constraints, which count Unicode code points and stop at embedded NUL.

`CmsError.code` is a sanitized domain code: UNAUTHENTICATED, FORBIDDEN, VALIDATION_ERROR, NOT_FOUND, CONFLICT, COLLECTION_EXISTS, COLLECTION_TABLE_ORPHANED, FIELD_EXISTS, RESERVED_SLUG, LIMIT_EXCEEDED or MIGRATION_REQUIRED. The registered remote response mapper maps these to 401/403/400/404/409/503 and does not expose raw SQLite/Kysely error messages. Unexpected database errors should become a generic server error with server-side diagnostics.

## SQL tooling and hosting rationale

The [pinned upstream Node adapter](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/packages/core/src/db/sqlite.ts) uses Kysely's SqliteDialect and a compatibility wrapper around node:sqlite. We retain its driver wrapper and all eleven driver test cases. Kysely 0.29.2 and ulidx 2.4.1 are retained from the initial upstream lockfile review. The wrapper needs no native npm addon; ulidx preserves upstream ULID identities.

[Kysely dialect documentation](https://kysely.dev/docs/dialects) supports keeping query/schema construction independent of the driver. [Node SQLite documentation](https://nodejs.org/docs/latest-v24.x/api/sqlite.html) describes DatabaseSync and parameter binding; its methods execute synchronously. [SQLite transaction documentation](https://www.sqlite.org/lang_transaction.html) explains BEGIN IMMEDIATE and single-writer locks. The local batch therefore acquires Kysely's connection mutex, runs the entire native transaction synchronously, and rolls back on any statement failure. Real database tests cover rollback and optimistic concurrency.

The adapter contract exposes only a Kysely instance, `atomicBatch(compiledQueries)`, and close. `openD1(trustedRawBinding)` now implements that seam with exactly one [D1 binding batch](https://developers.cloudflare.com/d1/worker-api/d1-database/) per atomic batch. [The D1 contract and evidence](d1-database.md) covers real local DDL/DML rollback, fresh/v1 auth migrations and forced concurrent races, scalar/schema/CAS/soft-delete/session persistence, equivalent Node behavior and raw parameter/result differences. It rejects callback transactions and generic introspection. No deployment, live resources or production composition are supplied. Interrupted requests, sessions/bookmarks and live D1 limits remain unverified.

The existing `sh scripts/bootstrap.sh` command installs the frozen lockfile, checks Svelte/TypeScript, runs all real database and existing service/development tests, builds, and checks production remotes. Hosted CI also runs sandboxed browser tests. The original database foundation changed no CI, remote, route or app-local files; the subsequent registered integration is documented below. See [the assertion inventory and scope ledger](database-parity.md) for tested ports, supplemental coverage, deliberate bounds and blocked/unported behavior.

Registered SvelteKit integration now consumes this database service through [the content remote handoff](content-remotes.md). Production session/adapter composition remains unverified; bounded local D1 storage is verified separately. The bounded integration corrects two storage defects: expected unique violations become structured conflicts, and scalar data validation preserves valid constructor/prototype schema keys that Valibot record validation silently dropped.

## Mutation authorization cleanup

The private service helper now authenticates and checks edit-own/edit-any or delete-own/delete-any once before parsing, returning the existing copied actor to the stored-owner helper. Anonymous requests still fail UNAUTHENTICATED before input inspection; authenticated callers without the relevant permission fail FORBIDDEN before validation or reads. Permitted calls still validate input, require an existing draft, check the persisted owner and pass the own actor ID to the repository's SQL owner predicate. Version/updatedAt CAS, schema guards and atomic storage remain unchanged.

The EmDash 1.1.0 pin `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e` remains authoritative; C-06 and the existing own/any policy differences are retained. New supplemental [database tests](../tests/database.test.ts) exercise hostile input getters against unauthorized services on an unmigrated database, and authorized malformed input still fails validation before storage. Existing ownership, missing-record, conflict, rollback and two-connection CAS tests are required. This private-helper refinement has no intended observable difference and gains no additional parity credit. Proposed in the session/permission cleanup PR; user authorized this audited cleanup on 2026-10-02, not a security-policy change.
