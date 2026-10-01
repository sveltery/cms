# Self-hosted database foundation

This slice supplies a server-only database/domain API. Authentication, dashboard schema editing, remote-function transport and hosting adapters are separate integration work. Nothing opens a database, runs migrations or creates a principal at module import, and no public write route is enabled.

## Runtime contract

Use Node 24 and pnpm 12.6.0. The local adapter is `openSqlite(path)` from `src/lib/server/database/sqlite.ts`; close it at process shutdown. An operator explicitly runs `migrateCms(database)` before serving requests. Preserve the SQLite file and WAL files on persistent local storage. Make backups before later migration work; system migrations are forward-only. An existing version-one marker must have all three system tables; otherwise startup fails with MIGRATION_REQUIRED without attempting repair. This presence check is not a complete schema checksum or corruption-recovery mechanism.

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

`CmsError.code` is a sanitized domain code: UNAUTHENTICATED, FORBIDDEN, VALIDATION_ERROR, NOT_FOUND, CONFLICT, COLLECTION_EXISTS, COLLECTION_TABLE_ORPHANED, FIELD_EXISTS, RESERVED_SLUG, LIMIT_EXCEEDED or MIGRATION_REQUIRED. The future remote response mapper should map these to 401/403/400/404/409/503 as appropriate and must not expose raw SQLite/Kysely error messages. Unexpected database errors should become a generic server error with server-side diagnostics.

## SQL tooling and hosting rationale

The [pinned upstream Node adapter](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/packages/core/src/db/sqlite.ts) uses Kysely's SqliteDialect and a compatibility wrapper around node:sqlite. We retain its driver wrapper and all eleven driver test cases. Kysely 0.29.2 and ulidx 2.4.1 are retained from the initial upstream lockfile review. The wrapper needs no native npm addon; ulidx preserves upstream ULID identities.

[Kysely dialect documentation](https://kysely.dev/docs/dialects) supports keeping query/schema construction independent of the driver. [Node SQLite documentation](https://nodejs.org/docs/latest-v24.x/api/sqlite.html) describes DatabaseSync and parameter binding; its methods execute synchronously. [SQLite transaction documentation](https://www.sqlite.org/lang_transaction.html) explains BEGIN IMMEDIATE and single-writer locks. The local batch therefore acquires Kysely's connection mutex, runs the entire native transaction synchronously, and rolls back on any statement failure. Real database tests cover rollback and optimistic concurrency.

The adapter contract exposes only a Kysely instance, `atomicBatch(compiledQueries)`, and close. [D1's database API](https://developers.cloudflare.com/d1/worker-api/d1-database/) provides prepare/bind and batch, but this PR does not implement or test a D1 adapter. A later D1 implementation must validate real binding behavior for guarded SQL batches, DDL rollback, duplicate/capacity/schema races, interrupted requests and restart/resume handling. It must not simulate callback transactions by running writes independently. Node and Cloudflare remain intended self-hosted targets; only the Node persistence path is validated here.

The existing `sh scripts/bootstrap.sh` command installs the frozen lockfile, checks Svelte/TypeScript, runs all real database and existing service/development tests, builds, and checks production remotes. Hosted CI also runs sandboxed browser tests. No CI, remote, route or app-local files are changed. See [the assertion inventory and scope ledger](database-parity.md) for tested ports, supplemental coverage, deliberate bounds and blocked/unported behavior.

Registered SvelteKit integration now consumes this database service through [the content remote handoff](content-remotes.md). Production session/adapter composition and D1 remain unverified. The bounded integration corrects two storage defects: expected unique violations become structured conflicts, and scalar data validation preserves valid constructor/prototype schema keys that Valibot record validation silently dropped.
