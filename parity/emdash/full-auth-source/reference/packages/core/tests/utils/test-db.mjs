import { randomUUID } from "node:crypto";
import { Kysely, SqliteAdapter, SqliteDialect } from "kysely";
import { Pool } from "pg";
import { describe } from "vitest";
import { getExactMigrationStatus, getMigrationStatus, runMigrations, } from "../../src/database/migrations/runner.js";
import { FailFastPostgresDialect } from "../../src/database/pg-migration-lock.js";
import { openNodeSqliteDatabase } from "../../src/db/node-sqlite-compat.js";
import { waitForDeferredTasks } from "../../src/deferred-tasks.js";
import { resetRegisteredCollectionsCacheForTests } from "../../src/schema/collection-slugs-cache.js";
import { SchemaRegistry } from "../../src/schema/registry.js";
import { resetTaxonomyDefsCacheForTests } from "../../src/taxonomies/index.js";
/**
 * Clear the isolate-wide, schema-derived caches that live on globalThis and
 * therefore persist across tests within a vitest worker. A freshly created
 * test database must never be served another database's cached taxonomy
 * definitions, so we reset every time a new test DB is created.
 *
 * Note: we deliberately don't import from `../../src/loader.js` here — several
 * test files `vi.mock` that module to stub `getDb`, and pulling another export
 * through this shared util would blow up under those mocks. The loader's own
 * taxonomy-names cache predates this util and is reset via its public path.
 */
function resetSchemaCachesForTests() {
    resetTaxonomyDefsCacheForTests();
    resetRegisteredCollectionsCacheForTests();
}
// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
/**
 * PostgreSQL connection string for tests.
 * When set, Postgres tests run; when absent, they're skipped.
 */
export const PG_CONNECTION_STRING = process.env.EMDASH_TEST_PG ?? "";
/**
 * Whether a Postgres test database is available.
 */
export const hasPgTestDatabase = PG_CONNECTION_STRING.length > 0;
// ---------------------------------------------------------------------------
// SQLite helpers (unchanged)
// ---------------------------------------------------------------------------
/**
 * Create an in-memory SQLite database for testing
 */
export function createTestDatabase() {
    resetSchemaCachesForTests();
    const sqlite = openNodeSqliteDatabase(":memory:");
    return new Kysely({
        dialect: new SqliteDialect({
            database: sqlite,
        }),
    });
}
/**
 * Setup a test database with migrations run
 */
export async function setupTestDatabase() {
    const db = createTestDatabase();
    await runMigrations(db);
    return db;
}
/**
 * Setup a test database with standard test collections (post, page)
 * This creates the ec_post and ec_page tables with title and content fields
 */
export async function setupTestDatabaseWithCollections() {
    const db = await setupTestDatabase();
    const registry = new SchemaRegistry(db);
    // Create post collection
    await registry.createCollection({
        slug: "post",
        label: "Posts",
        labelSingular: "Post",
    });
    await registry.createField("post", {
        slug: "title",
        label: "Title",
        type: "string",
    });
    await registry.createField("post", {
        slug: "content",
        label: "Content",
        type: "portableText",
    });
    // Create page collection
    await registry.createCollection({
        slug: "page",
        label: "Pages",
        labelSingular: "Page",
    });
    await registry.createField("page", {
        slug: "title",
        label: "Title",
        type: "string",
    });
    await registry.createField("page", {
        slug: "content",
        label: "Content",
        type: "portableText",
    });
    return db;
}
/**
 * Cleanup and destroy a test database
 */
export async function teardownTestDatabase(db) {
    await waitForDeferredTasks();
    await db.destroy();
}
/**
 * Number of terms Cloudflare D1 allows in a compound SELECT
 * (SQLITE_LIMIT_COMPOUND_SELECT). Measured against a real D1: five
 * `UNION ALL` branches compile, six are rejected.
 */
export const D1_COMPOUND_SELECT_LIMIT = 5;
class LimitedCompoundSelectAdapter extends SqliteAdapter {
    compoundSelectLimit;
    constructor(compoundSelectLimit) {
        super();
        this.compoundSelectLimit = compoundSelectLimit;
    }
}
class LimitedCompoundSelectDialect extends SqliteDialect {
    #limit;
    constructor(config, limit) {
        super(config);
        this.#limit = limit;
    }
    createAdapter() {
        return new LimitedCompoundSelectAdapter(this.#limit);
    }
}
/**
 * Test database standing in for a backend with — or without — a
 * compound-SELECT ceiling.
 *
 * SQLite's upstream default is 500, so query shapes that D1 rejects run
 * happily in tests. Pass a number and the dialect declares the ceiling the way
 * the D1 dialect does, while prepare() rejects statements past it — where SQLite
 * itself raises the error — with D1's error text, so code that inspects the
 * message behaves the same. Pass null for a backend that imposes no ceiling.
 */
export async function setupTestDatabaseWithCompoundSelectLimit(limit = D1_COMPOUND_SELECT_LIMIT) {
    resetSchemaCachesForTests();
    const sqlite = openNodeSqliteDatabase(":memory:");
    const statements = [];
    const prepare = sqlite.prepare.bind(sqlite);
    sqlite.prepare = ((source) => {
        statements.push(source);
        const terms = source.split(/\b(?:UNION|INTERSECT|EXCEPT)\b/i).length;
        if (limit !== null && terms > limit) {
            throw new Error("too many terms in compound SELECT: SQLITE_ERROR");
        }
        return prepare(source);
    });
    const config = { database: sqlite };
    const dialect = limit === null ? new SqliteDialect(config) : new LimitedCompoundSelectDialect(config, limit);
    const db = new Kysely({ dialect });
    await runMigrations(db);
    return { db, statements };
}
// ---------------------------------------------------------------------------
// PostgreSQL helpers
// ---------------------------------------------------------------------------
// --- Per-worker database isolation -----------------------------------------
//
// Vitest runs test files in parallel worker processes that all share one
// Postgres server. The original harness isolated each test in its own *schema*
// inside one shared database. That breaks down under parallelism: Kysely's
// migrator introspects the catalog database-wide (`pg_namespace`, `pg_class`)
// with no schema filter, so a migration in one worker sees — and races against
// — the sibling schemas other workers are concurrently creating and dropping.
// The result is intermittent `schema/relation/column "test_…" does not exist`
// failures during setup (issue #1333).
//
// Postgres catalogs are *per database*, so giving each worker its own database
// fully isolates introspection. Within a worker, schemas are still created and
// dropped per test, but sequentially (Vitest runs one file at a time per
// worker and awaits hooks in order), so there is no concurrent catalog churn.
/** Validate an identifier we must interpolate into DDL (no bind params allowed). */
function assertSafeIdentifier(id) {
    if (!/^[a-z][a-z0-9_]*$/.test(id) || id.length > 63) {
        throw new Error(`Unsafe SQL identifier: ${id}`);
    }
}
/**
 * Name of the Postgres database dedicated to the current Vitest worker.
 * `VITEST_POOL_ID` is the stable worker-slot id (reused across files within a
 * worker); we fall back to the pid so the harness still works outside Vitest.
 */
function workerDatabaseName() {
    const raw = process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? String(process.pid);
    const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const name = `emdash_test_w_${slug}`;
    assertSafeIdentifier(name);
    return name;
}
/** Swap the database in a connection string for the per-worker database. */
function withDatabase(connectionString, database) {
    const url = new URL(connectionString);
    url.pathname = `/${database}`;
    return url.toString();
}
/**
 * Ensure the per-worker database exists and resolve its connection string.
 * Memoised per process so the create-database round-trip happens once.
 */
let workerConnPromise = null;
function getWorkerConnectionString() {
    if (!workerConnPromise) {
        workerConnPromise = (async () => {
            const dbName = workerDatabaseName();
            // Connect to the maintenance database from the original connection
            // string to issue CREATE DATABASE (which cannot run while connected
            // to its target, nor inside a transaction).
            const admin = new Pool({ connectionString: PG_CONNECTION_STRING, max: 1 });
            try {
                const { rows } = await admin.query("SELECT 1 AS exists FROM pg_database WHERE datname = $1", [dbName]);
                if (rows.length === 0) {
                    // Concurrent CREATE DATABASE calls (different worker names) can
                    // still collide on the template1 lock; retry a few times.
                    await createDatabaseWithRetry(admin, dbName);
                }
            }
            finally {
                await admin.end();
            }
            return withDatabase(PG_CONNECTION_STRING, dbName);
        })();
    }
    return workerConnPromise;
}
async function createDatabaseWithRetry(admin, dbName) {
    for (let attempt = 0; attempt < 10; attempt++) {
        try {
            await admin.query(`CREATE DATABASE ${dbName}`);
            return;
        }
        catch (error) {
            const msg = String(error instanceof Error ? error.message : error);
            // 42P04 = duplicate_database (another check-then-create raced us).
            if (/already exists|duplicate_database/i.test(msg))
                return;
            // "source database … is being accessed by other users" — template1
            // is locked by another concurrent CREATE DATABASE; back off and retry.
            if (attempt < 9 && /being accessed by other users/i.test(msg)) {
                await new Promise((resolve) => setTimeout(resolve, 50 + attempt * 50));
                continue;
            }
            throw error;
        }
    }
}
/**
 * Shared pool for the current worker's Postgres database. One pool per test
 * process, used for schema create/drop. Created lazily.
 */
let sharedPool = null;
async function getSharedPool() {
    if (!sharedPool) {
        const connectionString = await getWorkerConnectionString();
        sharedPool = new Pool({ connectionString, max: 10 });
    }
    return sharedPool;
}
/**
 * Generate a unique schema name for test isolation.
 *
 * Unique within the worker database via a monotonic counter (clock resolution
 * independent) plus crypto entropy, so two contexts in the same process can
 * never collide on a name. PostgreSQL identifiers are capped at 63 bytes; this
 * stays well under.
 */
let schemaCounter = 0;
function uniqueSchemaName() {
    const seq = (schemaCounter++).toString(36);
    const rand = randomUUID().replace(/-/g, "").slice(0, 12);
    return `test_${seq}_${rand}`;
}
/**
 * Create an isolated Postgres database for a single test.
 *
 * Each call creates a unique schema inside the worker's database and returns a
 * Kysely instance whose search_path is set to that schema. Tables are fully
 * isolated.
 *
 * Call `teardownTestPostgresDatabase()` in afterEach to drop the schema.
 */
export async function createTestPostgresDatabase() {
    resetSchemaCachesForTests();
    const connectionString = await getWorkerConnectionString();
    const pool = await getSharedPool();
    const schemaName = uniqueSchemaName();
    // Create the isolated schema using a raw connection
    const client = await pool.connect();
    try {
        await client.query(`CREATE SCHEMA ${schemaName}`);
    }
    finally {
        client.release();
    }
    // Create a Kysely instance that targets this schema.
    // Test schema comes first so CREATE TABLE goes there.
    // public is included for Postgres system functions and extensions.
    const testPool = new Pool({
        connectionString,
        max: 5,
        options: `-c search_path=${schemaName},public`,
    });
    const db = new Kysely({
        // Same dialect as the production Postgres adapters so every PG test
        // exercises the fail-fast migration lock.
        dialect: new FailFastPostgresDialect({ pool: testPool }),
    });
    return { db, schemaName };
}
/**
 * Setup a Postgres test database with migrations run.
 */
export async function setupTestPostgresDatabase() {
    const ctx = await createTestPostgresDatabase();
    await runMigrations(ctx.db, { migrationTableSchema: ctx.schemaName });
    return ctx;
}
/**
 * Setup a Postgres test database with standard test collections (post, page).
 */
export async function setupTestPostgresDatabaseWithCollections() {
    const ctx = await setupTestPostgresDatabase();
    const registry = new SchemaRegistry(ctx.db);
    await registry.createCollection({
        slug: "post",
        label: "Posts",
        labelSingular: "Post",
    });
    await registry.createField("post", {
        slug: "title",
        label: "Title",
        type: "string",
    });
    await registry.createField("post", {
        slug: "content",
        label: "Content",
        type: "portableText",
    });
    await registry.createCollection({
        slug: "page",
        label: "Pages",
        labelSingular: "Page",
    });
    await registry.createField("page", {
        slug: "title",
        label: "Title",
        type: "string",
    });
    await registry.createField("page", {
        slug: "content",
        label: "Content",
        type: "portableText",
    });
    return ctx;
}
/**
 * Tear down a Postgres test database — drops the schema and closes the pool.
 */
export async function teardownTestPostgresDatabase(ctx) {
    await waitForDeferredTasks();
    // Destroy the test pool first
    await ctx.db.destroy();
    // Drop the schema using the shared pool
    const pool = await getSharedPool();
    const client = await pool.connect();
    try {
        await client.query(`DROP SCHEMA IF EXISTS ${ctx.schemaName} CASCADE`);
    }
    finally {
        client.release();
    }
}
/**
 * Shut down the shared Postgres pool. Call once at the end of the test run.
 */
export async function destroySharedPool() {
    if (sharedPool) {
        await sharedPool.end();
        sharedPool = null;
    }
}
/**
 * Create a bare test database for a given dialect (no migrations).
 */
export async function createForDialect(dialect) {
    if (dialect === "postgres") {
        const pgCtx = await createTestPostgresDatabase();
        return { db: pgCtx.db, dialect, pgCtx };
    }
    const db = createTestDatabase();
    return { db, dialect };
}
/**
 * Create a test database for a given dialect (with migrations).
 */
export async function setupForDialect(dialect) {
    if (dialect === "postgres") {
        const pgCtx = await setupTestDatabase_pg();
        return { db: pgCtx.db, dialect, pgCtx };
    }
    const db = await setupTestDatabase();
    return { db, dialect };
}
/**
 * Create a test database with collections for a given dialect.
 */
export async function setupForDialectWithCollections(dialect) {
    if (dialect === "postgres") {
        const pgCtx = await setupTestPostgresDatabaseWithCollections();
        return { db: pgCtx.db, dialect, pgCtx };
    }
    const db = await setupTestDatabaseWithCollections();
    return { db, dialect };
}
/**
 * A handle that `withTransaction` treats as an open transaction, so a handler
 * given it runs its statements inline instead of opening one of its own — D1's
 * boundary, where each statement that has run stays run.
 *
 * A real transaction can't stand in for that: Postgres aborts one on the first
 * error, so the read that checks what survived the failure fails too.
 */
export function asInlineTransaction(db) {
    return new Proxy(db, {
        get(target, prop) {
            if (prop === "isTransaction")
                return true;
            // Kysely reads private fields off `this`, which a proxy doesn't carry,
            // so both getters and methods have to see the real instance.
            const value = Reflect.get(target, prop);
            return typeof value === "function" ? value.bind(target) : value;
        },
    });
}
/**
 * Tear down a test database for any dialect.
 */
export async function teardownForDialect(ctx) {
    if (!ctx)
        return;
    if (ctx.pgCtx) {
        await teardownTestPostgresDatabase(ctx.pgCtx);
    }
    else {
        await teardownTestDatabase(ctx.db);
    }
}
export function runMigrationsForDialect(ctx) {
    return runMigrations(ctx.db, { migrationTableSchema: ctx.pgCtx?.schemaName });
}
export function getMigrationStatusForDialect(ctx) {
    return getMigrationStatus(ctx.db, { migrationTableSchema: ctx.pgCtx?.schemaName });
}
export function getExactMigrationStatusForDialect(ctx) {
    return getExactMigrationStatus(ctx.db, { migrationTableSchema: ctx.pgCtx?.schemaName });
}
// Private alias to avoid name collision
const setupTestDatabase_pg = setupTestPostgresDatabase;
/**
 * Run a describe block once per available dialect.
 *
 * When EMDASH_TEST_PG is not set, only SQLite runs.
 * When set, the suite runs for both SQLite and Postgres.
 *
 * @example
 * ```ts
 * describeEachDialect("Migrations", (dialectName) => {
 *   let ctx: DialectTestContext;
 *   beforeEach(async () => { ctx = await setupForDialect(dialectName); });
 *   afterEach(async () => { await teardownForDialect(ctx); });
 *
 *   it("creates tables", async () => {
 *     // ctx.db works with either dialect
 *   });
 * });
 * ```
 */
export function describeEachDialect(name, fn) {
    const dialects = ["sqlite"];
    if (hasPgTestDatabase) {
        dialects.push("postgres");
    }
    for (const dialect of dialects) {
        describe(`${name} [${dialect}]`, () => {
            fn(dialect);
        });
    }
}
