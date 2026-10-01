// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Raw-binding concurrency and batch/result mapping adapted from EmDash 1.1.0,
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/cloudflare/src/db/d1-dialect.ts.
import { Kysely, SqliteAdapter, SqliteQueryCompiler, type CompiledQuery, type DatabaseConnection,
  type Dialect, type Driver, type QueryResult } from 'kysely';
import type { CmsDatabase, CmsTables } from './contract.ts';

/** Structural subset of a trusted raw D1Database binding, never a D1DatabaseSession. */
export interface D1Binding {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<D1Result[]>;
}
export interface D1Statement {
  bind(...parameters: unknown[]): D1Statement;
  all(): Promise<D1Result>;
}
export interface D1Result {
  success: boolean;
  error?: string;
  results?: unknown[];
  meta: { changes: number; last_row_id?: number | null };
}

// Matches the pinned mapper, including undefined for zero affected rows.
function mapD1Result<Row>(result: D1Result): QueryResult<Row> {
  if (result.error) throw new Error(result.error);
  return {
    rows: (result.results ?? []) as Row[],
    numAffectedRows: result.meta.changes > 0 ? BigInt(result.meta.changes) : undefined,
    insertId: result.meta.last_row_id === undefined || result.meta.last_row_id === null ? undefined : BigInt(result.meta.last_row_id)
  };
}

class RawBindingD1Adapter extends SqliteAdapter {
  readonly compoundSelectLimit = 5;
  private readonly database: D1Binding;
  constructor(database: D1Binding) { super(); this.database = database; }
  // Raw subrequests are independent. A stalled read must not hold a Kysely connection mutex.
  // Session bookmark/coalescing semantics are outside this adapter's contract.
  override get supportsMultipleConnections() { return true; }
  async executeAtomicBatch(queries: readonly CompiledQuery[]): Promise<readonly QueryResult<unknown>[]> {
    const statements = queries.map(query => this.database.prepare(query.sql).bind(...query.parameters));
    return (await this.database.batch(statements)).map(mapD1Result);
  }
  override async acquireMigrationLock(): Promise<void> { throw new Error('Use explicit migrateCms atomic batches; Kysely migrations are unsupported'); }
  override async releaseMigrationLock(): Promise<void> { throw new Error('Kysely migrations are unsupported'); }
}

class D1Connection implements DatabaseConnection {
  private readonly database: D1Binding;
  constructor(database: D1Binding) { this.database = database; }
  async executeQuery<Row>(query: CompiledQuery): Promise<QueryResult<Row>> {
    return mapD1Result<Row>(await this.database.prepare(query.sql).bind(...query.parameters).all());
  }
  async *streamQuery<Row>(): AsyncIterableIterator<QueryResult<Row>> { throw new Error('D1 streaming is unsupported'); }
}
class D1Driver implements Driver {
  private readonly database: D1Binding;
  constructor(database: D1Binding) { this.database = database; }
  async init() {}
  async acquireConnection() { return new D1Connection(this.database); }
  async releaseConnection() {}
  async destroy() {} // Binding lifetime belongs to the caller/runtime.
  async beginTransaction(): Promise<void> { throw new Error('D1 callback transactions are unsupported; use atomicBatch'); }
  async commitTransaction(): Promise<void> { throw new Error('D1 callback transactions are unsupported'); }
  async rollbackTransaction(): Promise<void> { throw new Error('D1 callback transactions are unsupported'); }
}

/** Bounded raw-binding dialect. No sessions, introspector or general migration runner. */
export class RawBindingD1Dialect implements Dialect {
  private readonly database: D1Binding;
  constructor(database: D1Binding) { this.database = database; }
  createAdapter() { return new RawBindingD1Adapter(this.database); }
  createDriver() { return new D1Driver(this.database); }
  createQueryCompiler() { return new SqliteQueryCompiler(); }
  createIntrospector(): never { throw new Error('D1 introspection is outside the bounded CMS adapter'); }
}

/** Explicit trusted binding injection only; no resource lookup, migration or production factory. */
export function openD1(binding: D1Binding): CmsDatabase {
  const dialect = new RawBindingD1Dialect(binding);
  const adapter = dialect.createAdapter();
  const db = new Kysely<CmsTables>({ dialect });
  return {
    db,
    async atomicBatch(statements) {
      // Use Kysely's lifecycle without its SQLite mutex or callback transaction emulation.
      return db.connection().execute(() => adapter.executeAtomicBatch(statements));
    },
    async close() { await db.destroy(); }
  };
}
